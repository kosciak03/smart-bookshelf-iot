/**
 * @packageDocumentation
 * Smart shelf logic: reacts to sensor messages from the ESP32 (FSR, RFID,
 * status), keeps book locations and slot states in the database, records
 * shelf events and drives the LED strip.
 *
 * **Scenarios**
 * - *Put a book back*: the user scans the book's RFID tag → its slot blinks
 *   green (a book without a slot gets the first free one). Placing it in that
 *   slot confirms (short solid green, book `ON_SHELF`); placing it in another
 *   slot records `MISPLACED` and blinks that slot red until the book is taken
 *   out again.
 * - *Find a book*: `locateBook()` / `locateSlot()` blink the slot blue until the book is taken
 *   out or the highlight times out.
 * - *Take a book*: the FSR reports the slot empty → book `OFF_SHELF`.
 * - *Unknown tag*: the UID is kept as a pending tag so the user can link it to
 *   a book in the web app.
 *
 * Every inbound message and API action runs through one promise queue, so
 * state changes never interleave.
 */
import { EventEmitter } from "node:events";
import type { Prisma, ShelfEventType } from "@prisma/client";
import { env } from "../../config/env.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/http-errors.js";
import { prisma } from "../../lib/prisma.js";
import { bookInclude, type BookDto } from "../books/book.service.js";
import {
  buildLedFrame,
  deviceStatusSchema,
  fsrReadingSchema,
  HIGHLIGHT_PRIORITY,
  parseInboundTopic,
  rfidScanSchema,
  shelfTopic,
  type DeviceStatus,
  type FsrReading,
  type HighlightReason,
  type LedFrame,
  type RfidScan,
} from "./shelf.protocol.js";

/** Minimal MQTT publishing interface (implemented by the MQTT bridge; faked in tests). */
export interface ShelfPublisher {
  publish(topic: string, payload: string, options: { qos: 1; retain: boolean }): void;
}

/** Tunable parameters of the shelf logic. */
export interface ShelfConfig {
  topicPrefix: string;
  ledCount: number;
  /** Duration of LOCATE and PUT_BACK highlights (ms). */
  highlightMs: number;
  /** How long a scanned book is expected in its slot (ms). */
  expectMs: number;
  /** Duration of the CONFIRMED flash (ms). */
  confirmMs: number;
  /** How long an unknown tag stays available for linking (ms). */
  pendingTagMs: number;
}

/** Last known state of a shelf device. */
export interface DeviceState extends DeviceStatus {
  lastSeen: Date;
}

/** An RFID tag that was scanned but belongs to no book. */
export interface PendingTag {
  uid: string;
  shelfNumber: number;
  scannedAt: Date;
}

/** One slot in {@link ShelfState}. */
export interface SlotState {
  id: string;
  slotNumber: number;
  fsrChannel: number;
  ledStartIdx: number;
  ledEndIdx: number;
  isOccupied: boolean;
  isHighlighted: boolean;
  /** Strongest active highlight, `null` when the slot is dark. */
  highlight: HighlightReason | null;
  /** When the strongest highlight switches itself off (`null`: no highlight or no timeout). */
  highlightUntil: Date | null;
  book: { id: string; title: string; author: string; coverUrl: string | null; locationStatus: string } | null;
}

/** Body of `GET /api/shelf`. */
export interface ShelfState {
  shelfNumber: number;
  /** Last status reported by the ESP32 (`lastSeen: null` = never seen since the server started). */
  device: DeviceState | { online: false; lastSeen: null };
  /** Whether the backend is connected to the MQTT broker. */
  broker: { connected: boolean };
  slots: SlotState[];
  leds: LedFrame;
  pendingTag: PendingTag | null;
  /** Book the shelf waits for after an RFID scan. */
  expected: { bookId: string; slotId: string; until: Date } | null;
}

/** A slot lit by LOCATE. */
export interface LocatedSlot {
  id: string;
  shelfNumber: number;
  slotNumber: number;
  /** When the light switches itself off. */
  until: Date;
}

/** Change notification emitted after every state change (used by the SSE stream). */
export interface ShelfChange {
  shelfNumber: number;
  reason: "device" | "slot" | "rfid" | "highlight" | "assignment";
}

/** Active highlights of one slot: reason → expiry time (ms) or `null` (until cleared). */
type SlotHighlights = Map<HighlightReason, number | null>;

/**
 * Smart shelf service. One instance serves all shelves.
 */
export class ShelfService extends EventEmitter<{ change: [ShelfChange] }> {
  private publisher: ShelfPublisher | null = null;
  private readonly highlights = new Map<string, SlotHighlights>();
  private readonly devices = new Map<number, DeviceState>();
  private readonly lastFrames = new Map<number, string>();
  /** Books lying in a wrong slot: slot id → book id (set on MISPLACED, cleared on removal). */
  private readonly misplaced = new Map<string, string>();
  private expected: { bookId: string; slotId: string; shelfNumber: number; until: number } | null = null;
  private pendingTag: (PendingTag & { expiresAt: number }) | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  /**
   * @param config - Timing and topic parameters.
   * @param now - Clock (injected in tests).
   */
  constructor(
    private readonly config: ShelfConfig,
    private readonly now: () => number = Date.now,
  ) {
    super();
  }

  /** Sets (or removes) the MQTT publisher. */
  setPublisher(publisher: ShelfPublisher | null): void {
    this.publisher = publisher;
  }

  /** Whether an MQTT publisher is attached (the broker connection is up). */
  get connected(): boolean {
    return this.publisher !== null;
  }

  /** Clears all in-memory state (tests and broker reconnects). */
  reset(): void {
    this.highlights.clear();
    this.devices.clear();
    this.lastFrames.clear();
    this.misplaced.clear();
    this.expected = null;
    this.pendingTag = null;
  }

  /**
   * Runs a task after all previously queued tasks.
   *
   * @param task - State-changing operation.
   * @returns The task result.
   */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(task);
    this.queue = result.catch(() => undefined);
    return result;
  }

  // ---------------------------------------------------------------------------
  // Inbound MQTT messages
  // ---------------------------------------------------------------------------

  /**
   * Handles a message from the broker. Invalid topics or payloads are logged
   * and ignored (a misbehaving device must not crash the server).
   *
   * @param topic - MQTT topic.
   * @param payload - Raw payload.
   */
  handleMessage(topic: string, payload: Buffer | string): Promise<void> {
    return this.enqueue(async () => {
      const route = parseInboundTopic(this.config.topicPrefix, topic);
      if (route === null) return;

      let json: unknown;
      try {
        json = JSON.parse(payload.toString());
      } catch {
        console.warn(`[shelf] Ignoring non-JSON payload on ${topic}`);
        return;
      }

      const schema = { status: deviceStatusSchema, fsr: fsrReadingSchema, rfid: rfidScanSchema }[route.kind];
      const parsed = schema.safeParse(json);
      if (!parsed.success) {
        console.warn(`[shelf] Ignoring invalid ${route.kind} payload on ${topic}: ${parsed.error.issues[0]?.message}`);
        return;
      }

      try {
        if (route.kind === "status") await this.onStatus(route.shelfNumber, parsed.data as DeviceStatus);
        else if (route.kind === "fsr") await this.onFsr(route.shelfNumber, parsed.data as FsrReading);
        else await this.onRfid(route.shelfNumber, parsed.data as RfidScan);
      } catch (error) {
        console.error(`[shelf] Failed to handle ${topic}:`, error);
      }
    });
  }

  /** Device came online or went offline. */
  private async onStatus(shelfNumber: number, status: DeviceStatus): Promise<void> {
    this.devices.set(shelfNumber, { ...status, lastSeen: new Date(this.now()) });
    if (status.online) await this.publishLeds(shelfNumber, true);
    this.emit("change", { shelfNumber, reason: "device" });
  }

  /** A pressure sensor changed state. */
  private async onFsr(shelfNumber: number, reading: FsrReading): Promise<void> {
    this.touchDevice(shelfNumber);
    const slot = await prisma.shelfSlot.findUnique({
      where: { shelfNumber_fsrChannel: { shelfNumber, fsrChannel: reading.channel } },
      include: { book: { select: { id: true, locationStatus: true } } },
    });
    if (slot === null) {
      console.warn(`[shelf] No slot is wired to FSR channel ${reading.channel} on shelf ${shelfNumber}`);
      return;
    }
    // The device re-sends every channel after (re)connecting; unchanged states are no-ops.
    if (slot.isOccupied === reading.occupied) return;

    const payload = reading.raw === undefined ? undefined : { raw: reading.raw };
    const expected = this.activeExpectation(shelfNumber);

    if (reading.occupied) {
      const placedBookId = expected?.bookId ?? slot.book?.id ?? null;
      await prisma.$transaction(async (tx) => {
        await tx.shelfSlot.update({ where: { id: slot.id }, data: { isOccupied: true } });
        await this.recordEvent(tx, "BOOK_PLACED", { slotId: slot.id, bookId: placedBookId, payload });
        if (expected === null) {
          if (slot.book !== null) await tx.book.update({ where: { id: slot.book.id }, data: { locationStatus: "ON_SHELF" } });
        } else if (expected.slotId === slot.id) {
          await tx.book.update({ where: { id: expected.bookId }, data: { locationStatus: "ON_SHELF" } });
        } else {
          const expectedSlot = await tx.shelfSlot.findUnique({ where: { id: expected.slotId }, select: { slotNumber: true } });
          await this.recordEvent(tx, "MISPLACED", {
            slotId: slot.id,
            bookId: expected.bookId,
            payload: { expectedSlotNumber: expectedSlot?.slotNumber ?? null },
          });
        }
      });

      if (expected !== null && expected.slotId === slot.id) {
        this.removeHighlight(slot.id, "PUT_BACK");
        this.addHighlight(slot.id, "CONFIRMED", this.now() + this.config.confirmMs);
        this.expected = null;
      } else if (expected !== null) {
        this.addHighlight(slot.id, "MISPLACED", null);
        this.misplaced.set(slot.id, expected.bookId);
      }
      this.removeHighlight(slot.id, "LOCATE");
    } else {
      // A misplaced book is taken out of the wrong slot; the slot's own book is unaffected.
      const misplacedBookId = this.misplaced.get(slot.id);
      this.misplaced.delete(slot.id);
      await prisma.$transaction(async (tx) => {
        await tx.shelfSlot.update({ where: { id: slot.id }, data: { isOccupied: false } });
        await this.recordEvent(tx, "BOOK_REMOVED", {
          slotId: slot.id,
          bookId: misplacedBookId ?? slot.book?.id ?? null,
          payload: { ...payload, ...(misplacedBookId ? { misplaced: true } : {}) },
        });
        if (misplacedBookId === undefined && slot.book?.locationStatus === "ON_SHELF") {
          await tx.book.update({ where: { id: slot.book.id }, data: { locationStatus: "OFF_SHELF" } });
        }
        // Taking the located book out means it was found.
        if (this.hasHighlight(slot.id, "LOCATE")) {
          await this.recordEvent(tx, "HIGHLIGHT_OFF", { slotId: slot.id, bookId: slot.book?.id ?? null, payload: { reason: "LOCATE", cause: "removed" } });
        }
      });
      this.removeHighlight(slot.id, "LOCATE");
      this.removeHighlight(slot.id, "MISPLACED");
      this.removeHighlight(slot.id, "CONFIRMED");
    }

    await this.publishLeds(shelfNumber);
    this.emit("change", { shelfNumber, reason: "slot" });
  }

  /** An RFID tag was read. */
  private async onRfid(shelfNumber: number, scan: RfidScan): Promise<void> {
    this.touchDevice(shelfNumber);
    const book = await prisma.book.findUnique({
      where: { rfidUid: scan.uid },
      select: { id: true, slot: { select: { id: true, shelfNumber: true } } },
    });

    if (book === null) {
      await this.recordEvent(prisma, "RFID_SCANNED", { rfidUid: scan.uid, payload: { known: false } });
      this.pendingTag = {
        uid: scan.uid,
        shelfNumber,
        scannedAt: new Date(this.now()),
        expiresAt: this.now() + this.config.pendingTagMs,
      };
      this.emit("change", { shelfNumber, reason: "rfid" });
      return;
    }

    let slotId = book.slot?.shelfNumber === shelfNumber ? book.slot.id : null;
    let assigned = false;
    if (book.slot === null) {
      const free = await prisma.shelfSlot.findFirst({
        where: { shelfNumber, book: null, isOccupied: false },
        orderBy: { slotNumber: "asc" },
        select: { id: true },
      });
      if (free !== null) {
        await prisma.book.update({ where: { id: book.id }, data: { slotId: free.id, locationStatus: "OFF_SHELF" } });
        slotId = free.id;
        assigned = true;
      }
    }

    await this.recordEvent(prisma, "RFID_SCANNED", {
      rfidUid: scan.uid,
      bookId: book.id,
      slotId,
      payload: { known: true, ...(assigned ? { assignedSlot: true } : {}), ...(slotId === null ? { noSlot: true } : {}) },
    });

    if (slotId !== null) {
      // Only one book is expected at a time; the previous guidance ends.
      if (this.expected !== null && this.expected.slotId !== slotId) this.removeHighlight(this.expected.slotId, "PUT_BACK");
      this.expected = { bookId: book.id, slotId, shelfNumber, until: this.now() + this.config.expectMs };
      this.addHighlight(slotId, "PUT_BACK", this.now() + this.config.highlightMs);
      await this.recordEvent(prisma, "HIGHLIGHT_ON", { slotId, bookId: book.id, payload: { reason: "PUT_BACK" } });
      await this.publishLeds(shelfNumber);
    } else {
      console.warn(`[shelf] Book ${book.id} has no slot on shelf ${shelfNumber} and no slot is free`);
    }
    this.emit("change", { shelfNumber, reason: assigned ? "assignment" : "rfid" });
  }

  // ---------------------------------------------------------------------------
  // Actions from the REST API
  // ---------------------------------------------------------------------------

  /**
   * Lights the slot of a book so the user can find it.
   *
   * @param bookId - Book id.
   * @returns The lit slot.
   * @throws {@link NotFoundError} for an unknown book; {@link ConflictError} when it has no slot.
   */
  locateBook(bookId: string): Promise<LocatedSlot> {
    return this.enqueue(async () => {
      const book = await prisma.book.findUnique({
        where: { id: bookId },
        select: { id: true, slot: { select: { id: true, shelfNumber: true, slotNumber: true } } },
      });
      if (book === null) throw new NotFoundError("Book", bookId);
      if (book.slot === null) throw new ConflictError("CONFLICT", "This book has no shelf slot; assign one first");
      return this.startLocate(book.slot, bookId);
    });
  }

  /**
   * Lights a slot directly (also an empty one), e.g. from the shelf strip in
   * the web app.
   *
   * @param slotId - Slot id.
   * @returns The lit slot and when the light switches itself off.
   * @throws {@link NotFoundError} for an unknown slot.
   */
  locateSlot(slotId: string): Promise<LocatedSlot> {
    return this.enqueue(async () => {
      const slot = await prisma.shelfSlot.findUnique({
        where: { id: slotId },
        select: { id: true, shelfNumber: true, slotNumber: true, book: { select: { id: true } } },
      });
      if (slot === null) throw new NotFoundError("Shelf slot", slotId);
      return this.startLocate(slot, slot.book?.id ?? null);
    });
  }

  /**
   * Switches off the LOCATE light of a slot before its timeout.
   *
   * @param slotId - Slot id.
   * @throws {@link NotFoundError} for an unknown slot.
   */
  stopLocate(slotId: string): Promise<void> {
    return this.enqueue(async () => {
      const slot = await prisma.shelfSlot.findUnique({
        where: { id: slotId },
        select: { id: true, shelfNumber: true, book: { select: { id: true } } },
      });
      if (slot === null) throw new NotFoundError("Shelf slot", slotId);
      if (!this.hasHighlight(slot.id, "LOCATE")) return;
      this.removeHighlight(slot.id, "LOCATE");
      await this.recordEvent(prisma, "HIGHLIGHT_OFF", {
        slotId: slot.id,
        bookId: slot.book?.id ?? null,
        payload: { reason: "LOCATE", cause: "cancelled" },
      });
      await this.publishLeds(slot.shelfNumber);
      this.emit("change", { shelfNumber: slot.shelfNumber, reason: "highlight" });
    });
  }

  /** Lights a slot with LOCATE (runs inside the queue). */
  private async startLocate(
    slot: { id: string; shelfNumber: number; slotNumber: number },
    bookId: string | null,
  ): Promise<LocatedSlot> {
    const until = this.now() + this.config.highlightMs;
    this.addHighlight(slot.id, "LOCATE", until);
    await this.recordEvent(prisma, "HIGHLIGHT_ON", { slotId: slot.id, bookId, payload: { reason: "LOCATE" } });
    await this.publishLeds(slot.shelfNumber);
    this.emit("change", { shelfNumber: slot.shelfNumber, reason: "highlight" });
    return { id: slot.id, shelfNumber: slot.shelfNumber, slotNumber: slot.slotNumber, until: new Date(until) };
  }

  /**
   * Switches off every highlight of a shelf and forgets the expected book.
   *
   * @param shelfNumber - Shelf number.
   */
  clearHighlights(shelfNumber: number): Promise<void> {
    return this.enqueue(async () => {
      const slots = await prisma.shelfSlot.findMany({ where: { shelfNumber }, select: { id: true } });
      for (const slot of slots) {
        if (this.hasHighlight(slot.id, "LOCATE") || this.hasHighlight(slot.id, "PUT_BACK")) {
          await this.recordEvent(prisma, "HIGHLIGHT_OFF", { slotId: slot.id, payload: { cause: "cleared" } });
        }
        this.highlights.delete(slot.id);
        this.misplaced.delete(slot.id);
      }
      if (this.expected?.shelfNumber === shelfNumber) this.expected = null;
      await this.publishLeds(shelfNumber);
      this.emit("change", { shelfNumber, reason: "highlight" });
    });
  }

  /**
   * Assigns a book to a shelf slot or removes the assignment.
   *
   * @param bookId - Book id.
   * @param slotId - Slot id, or `null` to unassign.
   * @returns The updated book.
   */
  assignSlot(bookId: string, slotId: string | null): Promise<BookDto> {
    return this.enqueue(async () => {
      const book = await prisma.book.findUnique({ where: { id: bookId }, select: { id: true, slotId: true } });
      if (book === null) throw new NotFoundError("Book", bookId);

      if (slotId === null) {
        const updated = await prisma.book.update({
          where: { id: bookId },
          data: { slotId: null, locationStatus: "UNASSIGNED" },
          include: bookInclude,
        });
        if (book.slotId !== null) await this.afterAssignment(book.slotId);
        return updated;
      }

      const slot = await prisma.shelfSlot.findUnique({ where: { id: slotId }, include: { book: { select: { id: true } } } });
      if (slot === null) {
        throw new ValidationError("Invalid request body", [{ path: "body.slotId", message: `Shelf slot '${slotId}' does not exist` }]);
      }
      if (slot.book !== null && slot.book.id !== bookId) {
        throw new ConflictError("SLOT_CONFLICT", `Shelf slot ${slot.slotNumber} is already assigned to another book`);
      }
      const updated = await prisma.book.update({
        where: { id: bookId },
        // An occupied slot most likely already holds this book.
        data: { slotId, locationStatus: slot.isOccupied ? "ON_SHELF" : "OFF_SHELF" },
        include: bookInclude,
      });
      if (book.slotId !== null && book.slotId !== slotId) await this.afterAssignment(book.slotId);
      await this.afterAssignment(slotId);
      return updated;
    });
  }

  /**
   * Links an RFID tag to a book (or removes the link). A duplicate UID is
   * rejected by the database and reported as `RFID_CONFLICT`.
   *
   * @param bookId - Book id.
   * @param uid - Normalized tag UID, or `null`.
   * @returns The updated book.
   */
  assignRfid(bookId: string, uid: string | null): Promise<BookDto> {
    return this.enqueue(async () => {
      const exists = await prisma.book.findUnique({ where: { id: bookId }, select: { id: true } });
      if (exists === null) throw new NotFoundError("Book", bookId);
      const updated = await prisma.book.update({ where: { id: bookId }, data: { rfidUid: uid }, include: bookInclude });
      if (uid !== null && this.pendingTag?.uid === uid) {
        const { shelfNumber } = this.pendingTag;
        this.pendingTag = null;
        this.emit("change", { shelfNumber, reason: "rfid" });
      }
      return updated;
    });
  }

  /** Drops highlights of a slot whose book changed and refreshes the LEDs. */
  private async afterAssignment(slotId: string): Promise<void> {
    this.highlights.delete(slotId);
    if (this.expected?.slotId === slotId) this.expected = null;
    const slot = await prisma.shelfSlot.findUnique({ where: { id: slotId }, select: { shelfNumber: true } });
    if (slot !== null) {
      await this.publishLeds(slot.shelfNumber);
      this.emit("change", { shelfNumber: slot.shelfNumber, reason: "assignment" });
    }
  }

  // ---------------------------------------------------------------------------
  // Timers
  // ---------------------------------------------------------------------------

  /**
   * Removes expired highlights, expectations and pending tags. Called
   * periodically (every second) by the server.
   */
  expire(): Promise<void> {
    return this.enqueue(async () => {
      const now = this.now();
      const touchedSlots: string[] = [];
      for (const [slotId, reasons] of this.highlights) {
        for (const [reason, expiresAt] of reasons) {
          if (expiresAt === null || expiresAt > now) continue;
          reasons.delete(reason);
          touchedSlots.push(slotId);
          if (reason === "LOCATE" || reason === "PUT_BACK") {
            await this.recordEvent(prisma, "HIGHLIGHT_OFF", { slotId, payload: { reason, cause: "timeout" } });
          }
        }
        if (reasons.size === 0) this.highlights.delete(slotId);
      }
      if (this.expected !== null && this.expected.until <= now) this.expected = null;
      if (this.pendingTag !== null && this.pendingTag.expiresAt <= now) {
        const { shelfNumber } = this.pendingTag;
        this.pendingTag = null;
        this.emit("change", { shelfNumber, reason: "rfid" });
      }

      if (touchedSlots.length > 0) {
        const shelves = await prisma.shelfSlot.findMany({
          where: { id: { in: touchedSlots } },
          distinct: ["shelfNumber"],
          select: { shelfNumber: true },
        });
        for (const { shelfNumber } of shelves) {
          await this.publishLeds(shelfNumber);
          this.emit("change", { shelfNumber, reason: "highlight" });
        }
      }
    });
  }

  // ---------------------------------------------------------------------------
  // LEDs and state
  // ---------------------------------------------------------------------------

  /**
   * Publishes the LED frames of every shelf (after the broker connection is
   * established, as retained messages may have been lost).
   */
  republishAll(): Promise<void> {
    return this.enqueue(async () => {
      const shelves = await prisma.shelfSlot.findMany({ distinct: ["shelfNumber"], select: { shelfNumber: true } });
      for (const { shelfNumber } of shelves) await this.publishLeds(shelfNumber, true);
    });
  }

  /**
   * Computes the LED frame of a shelf, keeps `ShelfSlot.isHighlighted` in sync
   * and publishes the frame when it changed.
   *
   * @param shelfNumber - Shelf number.
   * @param force - Publish even when the frame is unchanged.
   */
  private async publishLeds(shelfNumber: number, force = false): Promise<void> {
    const frame = await this.syncSlotsAndBuildFrame(shelfNumber);
    const json = JSON.stringify(frame);
    if (!force && this.lastFrames.get(shelfNumber) === json) return;
    this.lastFrames.set(shelfNumber, json);
    this.publisher?.publish(shelfTopic(this.config.topicPrefix, shelfNumber, "leds"), json, { qos: 1, retain: true });
  }

  /** Updates `isHighlighted` of the shelf's slots and returns its LED frame. */
  private async syncSlotsAndBuildFrame(shelfNumber: number): Promise<LedFrame> {
    const slots = await prisma.shelfSlot.findMany({
      where: { shelfNumber },
      select: { id: true, ledStartIdx: true, ledEndIdx: true, isHighlighted: true },
    });
    for (const slot of slots) {
      const lit = (this.highlights.get(slot.id)?.size ?? 0) > 0;
      if (slot.isHighlighted !== lit) {
        await prisma.shelfSlot.update({ where: { id: slot.id }, data: { isHighlighted: lit } });
      }
    }
    return buildLedFrame(
      this.config.ledCount,
      slots.map((slot) => ({ ...slot, highlights: new Set(this.highlights.get(slot.id)?.keys() ?? []) })),
    );
  }

  /**
   * Returns the full state of a shelf for the web app.
   *
   * @param shelfNumber - Shelf number.
   */
  async getShelfState(shelfNumber: number): Promise<ShelfState> {
    const slots = await prisma.shelfSlot.findMany({
      where: { shelfNumber },
      orderBy: { slotNumber: "asc" },
      include: { book: { select: { id: true, title: true, author: true, coverUrl: true, locationStatus: true } } },
    });
    const device = this.devices.get(shelfNumber);
    const expected = this.activeExpectation(shelfNumber);
    return {
      shelfNumber,
      device: device ?? { online: false, lastSeen: null },
      broker: { connected: this.connected },
      slots: slots.map((slot) => ({
        id: slot.id,
        slotNumber: slot.slotNumber,
        fsrChannel: slot.fsrChannel,
        ledStartIdx: slot.ledStartIdx,
        ledEndIdx: slot.ledEndIdx,
        isOccupied: slot.isOccupied,
        isHighlighted: slot.isHighlighted,
        ...this.strongestHighlight(slot.id),
        book: slot.book,
      })),
      leds: buildLedFrame(
        this.config.ledCount,
        slots.map((slot) => ({ ...slot, highlights: new Set(this.highlights.get(slot.id)?.keys() ?? []) })),
      ),
      pendingTag: this.pendingTag && this.pendingTag.expiresAt > this.now() ? this.withoutExpiry(this.pendingTag) : null,
      expected: expected ? { bookId: expected.bookId, slotId: expected.slotId, until: new Date(expected.until) } : null,
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private withoutExpiry({ uid, shelfNumber, scannedAt }: PendingTag & { expiresAt: number }): PendingTag {
    return { uid, shelfNumber, scannedAt };
  }

  /** The book expected after an RFID scan, if still within its time window. */
  private activeExpectation(shelfNumber: number) {
    const expected = this.expected;
    return expected !== null && expected.shelfNumber === shelfNumber && expected.until > this.now() ? expected : null;
  }

  /** Marks a device as seen (sensor messages imply it is online). */
  private touchDevice(shelfNumber: number): void {
    const device = this.devices.get(shelfNumber);
    this.devices.set(shelfNumber, { ...(device ?? {}), online: true, lastSeen: new Date(this.now()) });
  }

  /** Strongest highlight of a slot and its expiry time. */
  private strongestHighlight(slotId: string): { highlight: HighlightReason | null; highlightUntil: Date | null } {
    const reasons = this.highlights.get(slotId);
    const highlight = HIGHLIGHT_PRIORITY.find((reason) => reasons?.has(reason)) ?? null;
    const expiresAt = highlight === null ? null : (reasons?.get(highlight) ?? null);
    return { highlight, highlightUntil: expiresAt === null ? null : new Date(expiresAt) };
  }

  private hasHighlight(slotId: string, reason: HighlightReason): boolean {
    return this.highlights.get(slotId)?.has(reason) ?? false;
  }

  private addHighlight(slotId: string, reason: HighlightReason, expiresAt: number | null): void {
    const reasons = this.highlights.get(slotId) ?? new Map();
    reasons.set(reason, expiresAt);
    this.highlights.set(slotId, reasons);
  }

  private removeHighlight(slotId: string, reason: HighlightReason): void {
    const reasons = this.highlights.get(slotId);
    reasons?.delete(reason);
    if (reasons?.size === 0) this.highlights.delete(slotId);
  }

  /** Appends a row to the shelf event log. */
  private recordEvent(
    db: Prisma.TransactionClient,
    type: ShelfEventType,
    data: { slotId?: string | null; bookId?: string | null; rfidUid?: string; payload?: Prisma.InputJsonValue | undefined },
  ) {
    return db.shelfEvent.create({
      data: {
        type,
        slotId: data.slotId ?? null,
        bookId: data.bookId ?? null,
        rfidUid: data.rfidUid ?? null,
        ...(data.payload === undefined ? {} : { payload: data.payload }),
      },
    });
  }
}

/** Shelf service of the application (configured from the environment). */
export const shelfService = new ShelfService({
  topicPrefix: env.MQTT_TOPIC_PREFIX,
  ledCount: env.SHELF_LED_COUNT,
  highlightMs: env.SHELF_HIGHLIGHT_SECONDS * 1000,
  expectMs: env.SHELF_EXPECT_SECONDS * 1000,
  confirmMs: 3000,
  pendingTagMs: 10 * 60 * 1000,
});
