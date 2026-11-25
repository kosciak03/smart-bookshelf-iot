/**
 * @packageDocumentation
 * MQTT protocol between the ESP32 shelf and the backend (see
 * `docs/mqtt-protocol.md`): topic names, payload schemas and the LED frame.
 *
 * Topics (`<prefix>` = `MQTT_TOPIC_PREFIX`, `<n>` = shelf number):
 *
 * | Topic                         | Direction       | QoS | Retained | Payload              |
 * | ----------------------------- | --------------- | --- | -------- | -------------------- |
 * | `<prefix>/shelf/<n>/status`   | device → server | 1   | yes      | {@link DeviceStatus} (also the LWT) |
 * | `<prefix>/shelf/<n>/fsr`      | device → server | 1   | no       | {@link FsrReading}   |
 * | `<prefix>/shelf/<n>/rfid`     | device → server | 1   | no       | {@link RfidScan}     |
 * | `<prefix>/shelf/<n>/leds`     | server → device | 1   | yes      | {@link LedFrame}     |
 *
 * The device knows only hardware channels (FSR 0–4, LED indexes); the mapping
 * to slots lives in the database, so re-wiring a slot needs no firmware change.
 */
import { z } from "zod";

/** Device → server message kinds. */
export type InboundKind = "status" | "fsr" | "rfid";

/** Builds a topic name. */
export function shelfTopic(prefix: string, shelfNumber: number, kind: InboundKind | "leds"): string {
  return `${prefix}/shelf/${shelfNumber}/${kind}`;
}

/** Topic filters the backend subscribes to (all shelves). */
export function inboundTopicFilters(prefix: string): string[] {
  return (["status", "fsr", "rfid"] as const).map((kind) => `${prefix}/shelf/+/${kind}`);
}

/**
 * Parses an inbound topic.
 *
 * @param prefix - Topic prefix.
 * @param topic - Received topic.
 * @returns Shelf number and message kind, or `null` for an unknown topic.
 */
export function parseInboundTopic(prefix: string, topic: string): { shelfNumber: number; kind: InboundKind } | null {
  const parts = topic.split("/");
  if (parts.length !== 4 || parts[0] !== prefix || parts[1] !== "shelf") return null;
  const shelfNumber = Number(parts[2]);
  const kind = parts[3];
  if (!Number.isInteger(shelfNumber) || shelfNumber < 1 || shelfNumber > 32_767) return null;
  if (kind !== "status" && kind !== "fsr" && kind !== "rfid") return null;
  return { shelfNumber, kind };
}

/** `status`: device online state; the broker publishes `{ "online": false }` as the Last Will. */
export const deviceStatusSchema = z.object({
  online: z.boolean(),
  firmware: z.string().max(40).optional(),
  ip: z.string().max(45).optional(),
  /** Wi-Fi signal strength in dBm. */
  rssi: z.number().int().min(-120).max(0).optional(),
});
export type DeviceStatus = z.infer<typeof deviceStatusSchema>;

/** `fsr`: debounced state change of one pressure sensor (also sent for every channel after connecting). */
export const fsrReadingSchema = z.object({
  /** FSR channel 0–4 (GPIO 34, 35, 32, 33, 36). */
  channel: z.number().int().min(0).max(4),
  occupied: z.boolean(),
  /** Raw 12-bit ADC value, for diagnostics. */
  raw: z.number().int().min(0).max(4095).optional(),
});
export type FsrReading = z.infer<typeof fsrReadingSchema>;

/** `rfid`: a tag held to the reader. */
export const rfidScanSchema = z.object({
  /** Tag UID as upper-case hex without separators (4, 7 or 10 bytes). */
  uid: z
    .string()
    .transform((value) => value.replace(/[\s:-]/g, "").toUpperCase())
    .pipe(z.string().regex(/^(?:[0-9A-F]{8}|[0-9A-F]{14}|[0-9A-F]{20})$/, "uid must be 4, 7 or 10 bytes of hex")),
});
export type RfidScan = z.infer<typeof rfidScanSchema>;

/** Lighting effect of one LED. */
export type LedEffect = "solid" | "blink";

/** One LED of the strip. */
export interface LedPixel {
  /** `#RRGGBB`; `#000000` = off. */
  color: string;
  effect: LedEffect;
}

/** `leds`: complete state of the strip (retained, so the device restores it after a reboot). */
export interface LedFrame {
  /** Protocol version of the frame format. */
  version: 1;
  /** One entry per LED, index 0 first. */
  pixels: LedPixel[];
}

/** Why a slot is lit. */
export type HighlightReason = "LOCATE" | "PUT_BACK" | "MISPLACED" | "CONFIRMED";

/** Colours and effects of the slot states (walls are static white). */
export const LED_STYLES: Record<HighlightReason | "OFF" | "WALL", LedPixel> = {
  /** "Find this book": the user asked where the book is. */
  LOCATE: { color: "#0091EA", effect: "blink" },
  /** "Put the scanned book here". */
  PUT_BACK: { color: "#00C853", effect: "blink" },
  /** "Wrong slot": a book was placed in a slot other than the expected one. */
  MISPLACED: { color: "#FF1744", effect: "blink" },
  /** Short confirmation after the book was placed in the right slot. */
  CONFIRMED: { color: "#00C853", effect: "solid" },
  OFF: { color: "#000000", effect: "solid" },
  WALL: { color: "#FFFFFF", effect: "solid" },
};

/** When several highlights apply to one slot, the first one in this list wins. */
export const HIGHLIGHT_PRIORITY: readonly HighlightReason[] = ["MISPLACED", "LOCATE", "PUT_BACK", "CONFIRMED"];

/** LED range and active highlights of one slot. */
export interface SlotLighting {
  ledStartIdx: number;
  ledEndIdx: number;
  highlights: ReadonlySet<HighlightReason>;
}

/**
 * Builds the LED frame of a shelf: LEDs belonging to a slot show the slot's
 * strongest highlight (or are off); every other LED is a white wall separator.
 *
 * @param ledCount - Number of LEDs on the strip.
 * @param slots - Slots of the shelf.
 * @returns The frame to publish.
 */
export function buildLedFrame(ledCount: number, slots: readonly SlotLighting[]): LedFrame {
  const pixels: LedPixel[] = Array.from({ length: ledCount }, () => ({ ...LED_STYLES.WALL }));
  for (const slot of slots) {
    const reason = HIGHLIGHT_PRIORITY.find((candidate) => slot.highlights.has(candidate));
    const style = reason === undefined ? LED_STYLES.OFF : LED_STYLES[reason];
    for (let index = slot.ledStartIdx; index <= Math.min(slot.ledEndIdx, ledCount - 1); index += 1) {
      pixels[index] = { ...style };
    }
  }
  return { version: 1, pixels };
}
