/**
 * @packageDocumentation
 * Scenario tests of the shelf logic: MQTT messages go into a ShelfService with
 * a controllable clock and a recording publisher; the database is the test
 * database.
 */
import type { ShelfEventType } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDatabase } from "../../test/db.js";
import { LED_STYLES, type LedFrame } from "./shelf.protocol.js";
import { ShelfService } from "./shelf.service.js";

const PREFIX = "smartbookshelf";
const TAG_A = "04A1B2C3D4E501";
const TAG_C = "04A1B2C3D4E503";
const UNKNOWN_TAG = "04FFFFFFFFFF01";

let clock = 0;
let published: Array<{ topic: string; payload: string; retain: boolean }> = [];
let service: ShelfService;
const slotIds: string[] = [];
const books = { a: "", b: "", c: "" };

/** Sends a device message to the service. */
function device(kind: "status" | "fsr" | "rfid", payload: unknown) {
  return service.handleMessage(`${PREFIX}/shelf/1/${kind}`, JSON.stringify(payload));
}

/** Last LED frame published for shelf 1. */
function lastFrame(): LedFrame {
  const message = published.filter((entry) => entry.topic === `${PREFIX}/shelf/1/leds`).at(-1);
  if (!message) throw new Error("No LED frame published");
  return JSON.parse(message.payload) as LedFrame;
}

/** LED of slot n (index 2n − 1). */
const ledOfSlot = (n: number) => lastFrame().pixels[2 * n - 1];

/** Shelf event types in chronological order. */
async function eventTypes(): Promise<ShelfEventType[]> {
  return (await prisma.shelfEvent.findMany({ orderBy: { createdAt: "asc" } })).map((event) => event.type);
}

/** Location status of a book. */
async function location(id: string) {
  return (await prisma.book.findUniqueOrThrow({ where: { id } })).locationStatus;
}

beforeEach(async () => {
  await resetDatabase();
  clock = 1_000_000;
  published = [];
  service = new ShelfService(
    { topicPrefix: PREFIX, ledCount: 11, highlightMs: 60_000, expectMs: 60_000, confirmMs: 3000, pendingTagMs: 600_000 },
    () => clock,
  );
  service.setPublisher({ publish: (topic, payload, { retain }) => published.push({ topic, payload, retain }) });

  slotIds.length = 0;
  for (let n = 1; n <= 5; n += 1) {
    const slot = await prisma.shelfSlot.create({
      data: { slotNumber: n, fsrChannel: n - 1, ledStartIdx: 2 * n - 1, ledEndIdx: 2 * n - 1, isOccupied: n === 2 },
    });
    slotIds.push(slot.id);
  }
  // A: tagged, assigned to slot 1, off the shelf. B: slot 2, on the shelf. C: tagged, no slot.
  books.a = (await prisma.book.create({ data: { title: "A", author: "X", rfidUid: TAG_A, slotId: slotIds[0]!, locationStatus: "OFF_SHELF" } })).id;
  books.b = (await prisma.book.create({ data: { title: "B", author: "X", slotId: slotIds[1]!, locationStatus: "ON_SHELF" } })).id;
  books.c = (await prisma.book.create({ data: { title: "C", author: "X", rfidUid: TAG_C } })).id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("putting a book back", () => {
  it("guides to the right slot, confirms the placement and turns the light off", async () => {
    await device("rfid", { uid: TAG_A });
    expect(ledOfSlot(1)).toEqual(LED_STYLES.PUT_BACK);
    expect(published.at(-1)?.retain).toBe(true);
    expect((await prisma.shelfSlot.findUniqueOrThrow({ where: { id: slotIds[0]! } })).isHighlighted).toBe(true);

    await device("fsr", { channel: 0, occupied: true, raw: 2300 });
    expect(await location(books.a)).toBe("ON_SHELF");
    expect(ledOfSlot(1)).toEqual(LED_STYLES.CONFIRMED);

    clock += 3100;
    await service.expire();
    expect(ledOfSlot(1)).toEqual(LED_STYLES.OFF);
    expect((await prisma.shelfSlot.findUniqueOrThrow({ where: { id: slotIds[0]! } })).isHighlighted).toBe(false);
    expect(await eventTypes()).toEqual(["RFID_SCANNED", "HIGHLIGHT_ON", "BOOK_PLACED"]);

    const placed = await prisma.shelfEvent.findFirstOrThrow({ where: { type: "BOOK_PLACED" } });
    expect(placed).toMatchObject({ bookId: books.a, slotId: slotIds[0], payload: { raw: 2300 } });
  });

  it("flags a wrong slot until the book is taken out, then accepts the right one", async () => {
    await device("rfid", { uid: TAG_A });
    await device("fsr", { channel: 2, occupied: true });

    expect(ledOfSlot(3)).toEqual(LED_STYLES.MISPLACED);
    expect(ledOfSlot(1)).toEqual(LED_STYLES.PUT_BACK);
    const misplaced = await prisma.shelfEvent.findFirstOrThrow({ where: { type: "MISPLACED" } });
    expect(misplaced).toMatchObject({ bookId: books.a, slotId: slotIds[2], payload: { expectedSlotNumber: 1 } });
    expect(await location(books.a)).toBe("OFF_SHELF");

    await device("fsr", { channel: 2, occupied: false });
    expect(ledOfSlot(3)).toEqual(LED_STYLES.OFF);
    const removed = await prisma.shelfEvent.findFirstOrThrow({ where: { type: "BOOK_REMOVED" } });
    expect(removed).toMatchObject({ bookId: books.a, payload: { misplaced: true } });

    await device("fsr", { channel: 0, occupied: true });
    expect(await location(books.a)).toBe("ON_SHELF");
    expect(ledOfSlot(1)).toEqual(LED_STYLES.CONFIRMED);
  });

  it("assigns the first free slot to a tagged book without one", async () => {
    await device("rfid", { uid: TAG_C });
    const book = await prisma.book.findUniqueOrThrow({ where: { id: books.c } });
    // Slot 1 and 2 have books; slot 3 is the first free one.
    expect(book).toMatchObject({ slotId: slotIds[2], locationStatus: "OFF_SHELF" });
    expect(ledOfSlot(3)).toEqual(LED_STYLES.PUT_BACK);
  });

  it("stops expecting the book after the time window", async () => {
    await device("rfid", { uid: TAG_A });
    clock += 61_000;
    await service.expire();
    expect(ledOfSlot(1)).toEqual(LED_STYLES.OFF);

    await device("fsr", { channel: 2, occupied: true });
    expect(await prisma.shelfEvent.count({ where: { type: "MISPLACED" } })).toBe(0);
    expect(await eventTypes()).toEqual(["RFID_SCANNED", "HIGHLIGHT_ON", "HIGHLIGHT_OFF", "BOOK_PLACED"]);
  });
});

describe("taking books and locating them", () => {
  it("marks a book off the shelf when its slot empties and back on when it is filled", async () => {
    await device("fsr", { channel: 1, occupied: false, raw: 40 });
    expect(await location(books.b)).toBe("OFF_SHELF");
    await device("fsr", { channel: 1, occupied: true });
    expect(await location(books.b)).toBe("ON_SHELF");
    expect(await eventTypes()).toEqual(["BOOK_REMOVED", "BOOK_PLACED"]);
  });

  it("ignores repeated sensor states (sent again after every reconnect)", async () => {
    await device("fsr", { channel: 1, occupied: true });
    await device("fsr", { channel: 0, occupied: false });
    expect(await eventTypes()).toEqual([]);
  });

  it("lights a located book until it is taken out", async () => {
    const slot = await service.locateBook(books.b);
    expect(slot).toMatchObject({ slotNumber: 2, shelfNumber: 1 });
    expect(ledOfSlot(2)).toEqual(LED_STYLES.LOCATE);

    await device("fsr", { channel: 1, occupied: false });
    expect(ledOfSlot(2)).toEqual(LED_STYLES.OFF);
    const off = await prisma.shelfEvent.findFirstOrThrow({ where: { type: "HIGHLIGHT_OFF" } });
    expect(off.payload).toEqual({ reason: "LOCATE", cause: "removed" });
  });

  it("switches a located slot off after the timeout or on request", async () => {
    await service.locateBook(books.b);
    clock += 60_001;
    await service.expire();
    expect(ledOfSlot(2)).toEqual(LED_STYLES.OFF);

    await service.locateBook(books.a);
    await service.clearHighlights(1);
    expect(ledOfSlot(1)).toEqual(LED_STYLES.OFF);
    expect(await eventTypes()).toEqual(["HIGHLIGHT_ON", "HIGHLIGHT_OFF", "HIGHLIGHT_ON", "HIGHLIGHT_OFF"]);
  });

  it("refuses to locate a book without a slot", async () => {
    await expect(service.locateBook(books.c)).rejects.toMatchObject({ status: 409 });
  });
});

describe("tags, device status and invalid input", () => {
  it("keeps an unknown tag pending until it is linked or expires", async () => {
    await device("rfid", { uid: "04:ff:ff:ff:ff:ff:01" });
    expect((await service.getShelfState(1)).pendingTag).toMatchObject({ uid: UNKNOWN_TAG, shelfNumber: 1 });
    const scanned = await prisma.shelfEvent.findFirstOrThrow({ where: { type: "RFID_SCANNED" } });
    expect(scanned).toMatchObject({ rfidUid: UNKNOWN_TAG, bookId: null, payload: { known: false } });

    await service.assignRfid(books.b, UNKNOWN_TAG);
    expect((await service.getShelfState(1)).pendingTag).toBeNull();

    await device("rfid", { uid: "DEADBEEF" });
    clock += 600_001;
    await service.expire();
    expect((await service.getShelfState(1)).pendingTag).toBeNull();
  });

  it("tracks the device status and re-sends the LED frame when it comes online", async () => {
    await device("status", { online: true, firmware: "1.0.0", rssi: -60 });
    const state = await service.getShelfState(1);
    expect(state.device).toMatchObject({ online: true, firmware: "1.0.0", rssi: -60 });
    expect(state.broker).toEqual({ connected: true });
    expect(published).toHaveLength(1);

    await device("status", { online: false });
    expect((await service.getShelfState(1)).device.online).toBe(false);
  });

  it("ignores malformed messages, unknown topics and unwired channels", async () => {
    await service.handleMessage(`${PREFIX}/shelf/1/fsr`, "not json");
    await device("fsr", { channel: 9, occupied: true });
    await device("rfid", { uid: "123" });
    await service.handleMessage(`${PREFIX}/shelf/1/unknown`, "{}");
    await prisma.shelfSlot.delete({ where: { id: slotIds[4]! } });
    await device("fsr", { channel: 4, occupied: true });
    expect(await eventTypes()).toEqual([]);
  });
});
