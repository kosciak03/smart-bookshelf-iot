-- Text search for GET /api/books?q= (see src/modules/books/book-search.ts).
--
-- pg_trgm provides trigram similarity (typo tolerance) and GIN indexes that
-- serve ILIKE and the word-similarity operator; unaccent folds diacritics so
-- that "wiedzmin" finds "Wiedźmin" and "lodz" finds "Łódź".

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- unaccent() is only STABLE (it depends on the dictionary setting), so it
-- cannot be used in an index. This wrapper pins the dictionary and is declared
-- IMMUTABLE, which is the documented way to index unaccented text.
CREATE OR REPLACE FUNCTION "immutable_unaccent"(text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE PARALLEL SAFE STRICT
AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

-- Trigram expression indexes (not expressible in schema.prisma).
CREATE INDEX "Book_title_search_idx" ON "Book" USING GIN ("immutable_unaccent"("title") gin_trgm_ops);
CREATE INDEX "Book_author_search_idx" ON "Book" USING GIN ("immutable_unaccent"("author") gin_trgm_ops);
CREATE INDEX "Book_publisher_search_idx" ON "Book" USING GIN ("immutable_unaccent"("publisher") gin_trgm_ops);

-- Partial ISBN search (LIKE '%…%') and tag containment (@>), declared in schema.prisma.
-- CreateIndex
CREATE INDEX "Book_isbn_trgm_idx" ON "Book" USING GIN ("isbn" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Book_tags_idx" ON "Book" USING GIN ("tags");
