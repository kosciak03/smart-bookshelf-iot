/**
 * @packageDocumentation
 * REST endpoints of the smart shelf.
 *
 * Mounted under `/api/shelf`:
 * | Method | Path                 | Response                                  |
 * | ------ | -------------------- | ----------------------------------------- |
 * | GET    | `/`                  | `{ data: ShelfState }` (query: `shelf`)   |
 * | GET    | `/events`            | `{ data: ShelfEvent[] }` (query: `shelf`, `limit`) |
 * | POST   | `/highlights/clear`  | 204 (query: `shelf`)                      |
 *
 * Mounted under `/api/books` (shelf actions on a book):
 * | Method | Path          | Body                    | Response                          |
 * | ------ | ------------- | ----------------------- | --------------------------------- |
 * | POST   | `/:id/locate` | —                       | `{ data: { slot } }`; 409 without slot |
 * | PUT    | `/:id/slot`   | `{ slotId: uuid\|null }` | `{ data: Book }`; 409 `SLOT_CONFLICT` |
 * | PUT    | `/:id/rfid`   | `{ uid: hex\|null }`     | `{ data: Book }`; 409 `RFID_CONFLICT` |
 */
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { parseRequest } from "../../lib/validate.js";
import { bookIdParamsSchema } from "../books/book.schemas.js";
import { rfidScanSchema } from "./shelf.protocol.js";
import { shelfService } from "./shelf.service.js";

/** Optional `shelf` query parameter (defaults to the single prototype shelf). */
const shelfQuerySchema = z.strictObject({
  shelf: z.coerce.number().int().min(1).max(32_767).default(1),
});

/** Query of `GET /api/shelf/events`. */
const eventsQuerySchema = shelfQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

/** Body of `PUT /api/books/:id/slot`. */
const assignSlotSchema = z.strictObject({
  slotId: z.uuid({ message: "slotId must be a valid UUID" }).nullable(),
});

/** Body of `PUT /api/books/:id/rfid` (UID normalized like device messages). */
const assignRfidSchema = z.strictObject({
  uid: rfidScanSchema.shape.uid.nullable(),
});

/** Router for `/api/shelf`. */
export const shelfRouter: Router = Router();

shelfRouter.get("/", async (req, res) => {
  const { shelf } = parseRequest(shelfQuerySchema, req.query, "query");
  res.json({ data: await shelfService.getShelfState(shelf) });
});

shelfRouter.get("/events", async (req, res) => {
  const { shelf, limit } = parseRequest(eventsQuerySchema, req.query, "query");
  const events = await prisma.shelfEvent.findMany({
    where: { OR: [{ slot: { shelfNumber: shelf } }, { slotId: null }] },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: limit,
    include: {
      book: { select: { id: true, title: true } },
      slot: { select: { id: true, slotNumber: true } },
    },
  });
  res.json({ data: events });
});

shelfRouter.post("/highlights/clear", async (req, res) => {
  const { shelf } = parseRequest(shelfQuerySchema, req.query, "query");
  await shelfService.clearHighlights(shelf);
  res.status(204).end();
});

/** Router with shelf actions on books (mounted under `/api/books`). */
export const bookShelfRouter: Router = Router();

bookShelfRouter.post("/:id/locate", async (req, res) => {
  const { id } = parseRequest(bookIdParamsSchema, req.params, "params");
  res.json({ data: { slot: await shelfService.locateBook(id) } });
});

bookShelfRouter.put("/:id/slot", async (req, res) => {
  const { id } = parseRequest(bookIdParamsSchema, req.params, "params");
  const { slotId } = parseRequest(assignSlotSchema, req.body, "body");
  res.json({ data: await shelfService.assignSlot(id, slotId) });
});

bookShelfRouter.put("/:id/rfid", async (req, res) => {
  const { id } = parseRequest(bookIdParamsSchema, req.params, "params");
  const { uid } = parseRequest(assignRfidSchema, req.body, "body");
  res.json({ data: await shelfService.assignRfid(id, uid) });
});
