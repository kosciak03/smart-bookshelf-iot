/**
 * @packageDocumentation
 * REST endpoints of the smart shelf.
 *
 * Mounted under `/api/shelf`:
 * | Method | Path                 | Response                                  |
 * | ------ | -------------------- | ----------------------------------------- |
 * | GET    | `/`                  | `{ data: ShelfState }` (query: `shelf`)   |
 * | GET    | `/events`            | `{ data: ShelfEvent[] }` (query: `shelf`, `limit`) |
 * | GET    | `/stream`            | Server-Sent Events: `event: shelf` on every change |
 * | POST   | `/highlights/clear`  | 204 (query: `shelf`)                      |
 * | POST   | `/slots/:id/locate`  | `{ data: { slot } }` – blink the slot (also empty) |
 * | DELETE | `/slots/:id/locate`  | 204 – switch the blinking off early       |
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
import { shelfService, type ShelfChange } from "./shelf.service.js";

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

/** Route parameters of `/api/shelf/slots/:id/...`. */
const slotIdParamsSchema = z.object({
  id: z.uuid({ message: "Slot id must be a valid UUID" }),
});

/** Interval of SSE comments that keep proxies from closing an idle stream (ms). */
const SSE_HEARTBEAT_MS = 25_000;

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

/**
 * Live change notifications for the web app (Server-Sent Events). Each event
 * only says *that* something changed (`{ shelfNumber, reason }`); the client
 * then re-fetches the shelf state and book lists.
 */
shelfRouter.get("/stream", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  res.write("retry: 3000\n\n");

  const onChange = (change: ShelfChange) => {
    res.write(`event: shelf\ndata: ${JSON.stringify(change)}\n\n`);
  };
  shelfService.on("change", onChange);
  const heartbeat = setInterval(() => res.write(": ping\n\n"), SSE_HEARTBEAT_MS);

  req.on("close", () => {
    clearInterval(heartbeat);
    shelfService.off("change", onChange);
  });
});

shelfRouter.post("/slots/:id/locate", async (req, res) => {
  const { id } = parseRequest(slotIdParamsSchema, req.params, "params");
  res.json({ data: { slot: await shelfService.locateSlot(id) } });
});

shelfRouter.delete("/slots/:id/locate", async (req, res) => {
  const { id } = parseRequest(slotIdParamsSchema, req.params, "params");
  await shelfService.stopLocate(id);
  res.status(204).end();
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
