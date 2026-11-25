/**
 * @packageDocumentation
 * Text search over books with the PostgreSQL `pg_trgm` extension.
 *
 * The phrase is split into whitespace-separated terms and **every** term has to
 * match at least one of: title, author, publisher (case- and
 * diacritic-insensitive substring or trigram word similarity, so small typos
 * and missing Polish characters are tolerated), ISBN (digits, hyphens ignored,
 * ISBN-10 converted) or a tag (exact, case-insensitive).
 *
 * Each match gets a relevance score: a substring match beats a fuzzy match, and
 * title matches weigh more than author and publisher matches. The scores of
 * all terms are summed.
 *
 * Every branch of the match condition is index-backed, so PostgreSQL can
 * combine the indexes with a bitmap OR instead of scanning the table:
 * - text columns are compared through `immutable_unaccent()` and use trigram
 *   GIN expression indexes (migration `add_search_trigram_indexes`), which
 *   serve both `ILIKE` and the `<%` word-similarity operator;
 * - `isbn` has a trigram GIN index (partial `LIKE '%…%'` matches);
 * - `tags` has a GIN array index (`@>` containment).
 */
import { Prisma } from "@prisma/client";
import { normalizeIsbn } from "../../lib/isbn.js";
import { prisma } from "../../lib/prisma.js";

/** Search match: book id and its relevance score (higher is better). */
export interface SearchMatch {
  id: string;
  score: number;
}

/** Field weights used in the relevance score. */
const WEIGHT = { title: 1, author: 0.8, publisher: 0.4 } as const;
/** Score bonus for a substring match (on top of the word similarity, which is then 1). */
const SUBSTRING_BONUS = 1;
/** Score of an ISBN or tag match (below a title substring match, which scores 2). */
const EXACT_MATCH_SCORE = 1.5;
/** Minimum number of digits for a partial ISBN match. */
const MIN_ISBN_DIGITS = 3;

/**
 * Escapes the `LIKE` wildcards (`%`, `_`) and the escape character itself.
 *
 * @param value - Raw user input.
 * @returns Value that matches literally inside a `LIKE` pattern.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

/**
 * Splits a search phrase into terms.
 *
 * @param phrase - Trimmed, non-empty search phrase.
 * @returns Lower-cased unique terms.
 */
export function splitSearchTerms(phrase: string): string[] {
  return [...new Set(phrase.toLowerCase().split(/\s+/).filter((term) => term !== ""))];
}

/**
 * Returns the ISBN fragment a term can match, if it looks like (part of) an ISBN.
 *
 * @param term - Single search term.
 * @returns A full ISBN-13 for a valid ISBN-10/13, digits of a partial ISBN, or `null`.
 */
export function isbnSearchFragment(term: string): string | null {
  const full = normalizeIsbn(term);
  if (full !== null) return full;
  const digits = term.replace(/[-\s]/g, "");
  return /^\d+$/.test(digits) && digits.length >= MIN_ISBN_DIGITS ? digits : null;
}

/**
 * Builds the SQL match condition and score expression of a single term.
 *
 * @param term - Lower-cased search term.
 * @returns `condition` (boolean) and `score` (float) SQL fragments.
 */
function termSql(term: string): { condition: Prisma.Sql; score: Prisma.Sql } {
  const pattern = Prisma.sql`immutable_unaccent(${`%${escapeLikePattern(term)}%`})`;
  const folded = Prisma.sql`immutable_unaccent(${term})`;
  const isbn = isbnSearchFragment(term);

  const title = Prisma.sql`immutable_unaccent("title")`;
  const author = Prisma.sql`immutable_unaccent("author")`;
  const publisher = Prisma.sql`immutable_unaccent("publisher")`;
  // Array containment (not `= ANY`) so that the GIN index on "tags" can be used.
  const tagMatch = Prisma.sql`"tags" @> ARRAY[${term}]::text[]`;
  const isbnMatch = isbn === null ? Prisma.sql`FALSE` : Prisma.sql`"isbn" LIKE ${`%${isbn}%`}`;

  const fieldScore = (column: Prisma.Sql, weight: number): Prisma.Sql =>
    Prisma.sql`${weight}::float8 * (word_similarity(${folded}, ${column})
      + CASE WHEN ${column} ILIKE ${pattern} THEN ${SUBSTRING_BONUS} ELSE 0 END)`;

  const condition = Prisma.sql`(
    ${title} ILIKE ${pattern} OR ${author} ILIKE ${pattern} OR ${publisher} ILIKE ${pattern}
    OR ${folded} <% ${title} OR ${folded} <% ${author} OR ${folded} <% ${publisher}
    OR ${tagMatch} OR ${isbnMatch}
  )`;

  const score = Prisma.sql`GREATEST(
    ${fieldScore(title, WEIGHT.title)},
    ${fieldScore(author, WEIGHT.author)},
    ${fieldScore(publisher, WEIGHT.publisher)},
    CASE WHEN ${tagMatch} THEN ${EXACT_MATCH_SCORE} ELSE 0 END,
    CASE WHEN ${isbnMatch} THEN ${EXACT_MATCH_SCORE} ELSE 0 END
  )`;

  return { condition, score };
}

/**
 * Finds all books matching a search phrase.
 *
 * @param phrase - Trimmed, non-empty search phrase (validated by the query schema).
 * @returns Matching book ids with relevance scores, best match first.
 */
export async function searchBooks(phrase: string): Promise<SearchMatch[]> {
  const terms = splitSearchTerms(phrase).map(termSql);
  if (terms.length === 0) return [];

  const where = Prisma.join(
    terms.map((term) => term.condition),
    " AND ",
  );
  const score = Prisma.join(
    terms.map((term) => term.score),
    " + ",
  );

  return prisma.$queryRaw<SearchMatch[]>`
    SELECT "id", (${score})::float8 AS "score"
    FROM "Book"
    WHERE ${where}
    ORDER BY "score" DESC, "id" ASC
  `;
}
