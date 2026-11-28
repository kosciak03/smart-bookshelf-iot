/**
 * @packageDocumentation
 * Integration tests for the shelf REST endpoints.
 */
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { prisma, resetDatabase } from "../../test/db.js";
import { shelfService } from "./shelf.service.js";

const app = createApp();
const slotIds: string[] = [];
let bookId = "";
let otherBookId = "";

beforeEach(async () => {
  await resetDatabase();
  shelfService.reset();
  shelfService.setPublisher(null);
  slotIds.length = 0;
  for (let n = 1; n <= 3; n += 1) {
    const slot = await prisma.shelfSlot.create({
      data: { slotNumber: n, fsrChannel: n - 1, ledStartIdx: 2 * n - 1, ledEndIdx: 2 * n - 1, isOccupied: n === 2 },
    });
    slotIds.push(slot.id);
  }
  bookId = (await prisma.book.create({ data: { title: "Dune", author: "Frank Herbert" } })).id;
  otherBookId = (await prisma.book.create({ data: { title: "Solaris", author: "Lem", slotId: slotIds[0]!, rfidUid: "DEADBEEF" } })).id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /api/shelf", () => {
  it("returns slots with their books, LEDs and device state", async () => {
    const response = await request(app).get("/api/shelf").expect(200);
    const state = response.body.data;
    expect(state).toMatchObject({
      shelfNumber: 1,
      device: { online: false, lastSeen: null },
      broker: { connected: false },
      pendingTag: null,
      expected: null,
    });
    expect(state.slots.map((slot: { slotNumber: number }) => slot.slotNumber)).toEqual([1, 2, 3]);
    expect(state.slots[0]).toMatchObject({ highlight: null, book: { id: otherBookId, title: "Solaris" } });
    expect(state.leds.pixels).toHaveLength(11);
  });

  it("validates the shelf number", async () => {
    await request(app).get("/api/shelf?shelf=0").expect(400);
  });
});

describe("PUT /api/books/:id/slot", () => {
  it("assigns a slot (ON_SHELF when the slot is occupied) and unassigns it", async () => {
    const assigned = await request(app).put(`/api/books/${bookId}/slot`).send({ slotId: slotIds[1] }).expect(200);
    expect(assigned.body.data).toMatchObject({ slotId: slotIds[1], locationStatus: "ON_SHELF", slot: { slotNumber: 2 } });

    const moved = await request(app).put(`/api/books/${bookId}/slot`).send({ slotId: slotIds[2] }).expect(200);
    expect(moved.body.data).toMatchObject({ locationStatus: "OFF_SHELF", slot: { slotNumber: 3 } });

    const cleared = await request(app).put(`/api/books/${bookId}/slot`).send({ slotId: null }).expect(200);
    expect(cleared.body.data).toMatchObject({ slotId: null, locationStatus: "UNASSIGNED", slot: null });
  });

  it("rejects a taken slot (409), an unknown slot (400) and an unknown book (404)", async () => {
    const taken = await request(app).put(`/api/books/${bookId}/slot`).send({ slotId: slotIds[0] }).expect(409);
    expect(taken.body.error.code).toBe("SLOT_CONFLICT");
    const unknown = await request(app).put(`/api/books/${bookId}/slot`).send({ slotId: randomUUID() }).expect(400);
    expect(unknown.body.error.details[0].path).toBe("body.slotId");
    await request(app).put(`/api/books/${randomUUID()}/slot`).send({ slotId: null }).expect(404);
    await request(app).put(`/api/books/${bookId}/slot`).send({}).expect(400);
  });
});

describe("PUT /api/books/:id/rfid", () => {
  it("links a normalized tag, rejects duplicates and unlinks", async () => {
    const linked = await request(app).put(`/api/books/${bookId}/rfid`).send({ uid: "04:a1:b2:c3:d4:e5:f6" }).expect(200);
    expect(linked.body.data.rfidUid).toBe("04A1B2C3D4E5F6");

    const duplicate = await request(app).put(`/api/books/${bookId}/rfid`).send({ uid: "deadbeef" }).expect(409);
    expect(duplicate.body.error.code).toBe("RFID_CONFLICT");

    await request(app).put(`/api/books/${bookId}/rfid`).send({ uid: "12345" }).expect(400);
    const unlinked = await request(app).put(`/api/books/${bookId}/rfid`).send({ uid: null }).expect(200);
    expect(unlinked.body.data.rfidUid).toBeNull();
  });
});

describe("locating and highlights", () => {
  it("locates a book, lists the event and clears the highlight", async () => {
    const located = await request(app).post(`/api/books/${otherBookId}/locate`).expect(200);
    expect(located.body.data.slot).toMatchObject({ id: slotIds[0], slotNumber: 1 });

    const state = (await request(app).get("/api/shelf").expect(200)).body.data;
    expect(state.slots[0]).toMatchObject({ highlight: "LOCATE", isHighlighted: true });
    expect(state.leds.pixels[1]).toEqual({ color: "#0091EA", effect: "blink" });

    const events = (await request(app).get("/api/shelf/events?limit=5").expect(200)).body.data;
    expect(events[0]).toMatchObject({ type: "HIGHLIGHT_ON", book: { title: "Solaris" }, slot: { slotNumber: 1 } });

    await request(app).post("/api/shelf/highlights/clear").expect(204);
    expect((await request(app).get("/api/shelf").expect(200)).body.data.slots[0].highlight).toBeNull();
  });

  it("returns 409 for a book without a slot and 404 for an unknown book", async () => {
    const response = await request(app).post(`/api/books/${bookId}/locate`).expect(409);
    expect(response.body.error.message).toMatch(/no shelf slot/);
    await request(app).post(`/api/books/${randomUUID()}/locate`).expect(404);
  });
});

describe("slot locate endpoints", () => {
  it("blinks any slot (also an empty one), reports when it switches off, and stops early", async () => {
    const before = Date.now();
    const located = await request(app).post(`/api/shelf/slots/${slotIds[2]}/locate`).expect(200);
    expect(located.body.data.slot).toMatchObject({ id: slotIds[2], slotNumber: 3 });
    const until = Date.parse(located.body.data.slot.until);
    // Default SHELF_HIGHLIGHT_SECONDS is 15 s.
    expect(until - before).toBeGreaterThanOrEqual(14_000);
    expect(until - before).toBeLessThanOrEqual(16_000);

    const state = (await request(app).get("/api/shelf").expect(200)).body.data;
    expect(state.slots[2]).toMatchObject({ highlight: "LOCATE", highlightUntil: located.body.data.slot.until });

    await request(app).delete(`/api/shelf/slots/${slotIds[2]}/locate`).expect(204);
    const after = (await request(app).get("/api/shelf").expect(200)).body.data;
    expect(after.slots[2]).toMatchObject({ highlight: null, highlightUntil: null });

    const events = (await request(app).get("/api/shelf/events?limit=2").expect(200)).body.data;
    expect(events.map((event: { type: string }) => event.type)).toEqual(["HIGHLIGHT_OFF", "HIGHLIGHT_ON"]);
    expect(events[0].payload).toEqual({ reason: "LOCATE", cause: "cancelled" });
  });

  it("returns 404 for an unknown slot and 400 for a malformed id", async () => {
    await request(app).post(`/api/shelf/slots/${randomUUID()}/locate`).expect(404);
    await request(app).delete(`/api/shelf/slots/${randomUUID()}/locate`).expect(404);
    await request(app).post("/api/shelf/slots/abc/locate").expect(400);
  });

  it("stopping a slot that is not blinking is a no-op", async () => {
    await request(app).delete(`/api/shelf/slots/${slotIds[0]}/locate`).expect(204);
    expect(await prisma.shelfEvent.count()).toBe(0);
  });
});

describe("GET /api/shelf/stream", () => {
  it("sends an SSE event when the shelf changes", async () => {
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    const controller = new AbortController();
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/shelf/stream`, { signal: controller.signal });
      expect(response.headers.get("content-type")).toContain("text/event-stream");
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let text = decoder.decode((await reader.read()).value);
      expect(text).toContain("retry: 3000");

      await request(app).post(`/api/shelf/slots/${slotIds[1]}/locate`).expect(200);
      while (!text.includes("event: shelf")) text += decoder.decode((await reader.read()).value);
      expect(text).toContain('data: {"shelfNumber":1,"reason":"highlight"}');
    } finally {
      controller.abort();
      server.close();
    }
  });
});
