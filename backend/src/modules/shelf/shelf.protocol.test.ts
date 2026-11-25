/**
 * @packageDocumentation
 * Unit tests of the MQTT protocol helpers.
 */
import { describe, expect, it } from "vitest";
import {
  buildLedFrame,
  fsrReadingSchema,
  inboundTopicFilters,
  LED_STYLES,
  parseInboundTopic,
  rfidScanSchema,
  shelfTopic,
  type HighlightReason,
} from "./shelf.protocol.js";

describe("topics", () => {
  it("builds and parses shelf topics", () => {
    expect(shelfTopic("smartbookshelf", 1, "leds")).toBe("smartbookshelf/shelf/1/leds");
    expect(inboundTopicFilters("p")).toEqual(["p/shelf/+/status", "p/shelf/+/fsr", "p/shelf/+/rfid"]);
    expect(parseInboundTopic("p", "p/shelf/2/fsr")).toEqual({ shelfNumber: 2, kind: "fsr" });
    expect(parseInboundTopic("p", "p/shelf/1/leds")).toBeNull();
    expect(parseInboundTopic("p", "other/shelf/1/fsr")).toBeNull();
    expect(parseInboundTopic("p", "p/shelf/x/fsr")).toBeNull();
    expect(parseInboundTopic("p", "p/shelf/1/fsr/extra")).toBeNull();
  });
});

describe("payload schemas", () => {
  it("normalizes RFID UIDs and accepts only 4, 7 or 10 bytes", () => {
    expect(rfidScanSchema.parse({ uid: "04:a1:b2:c3:d4:e5:01" })).toEqual({ uid: "04A1B2C3D4E501" });
    expect(rfidScanSchema.parse({ uid: "deadbeef" })).toEqual({ uid: "DEADBEEF" });
    expect(rfidScanSchema.safeParse({ uid: "0A1B2C3D4E" }).success).toBe(false);
    expect(rfidScanSchema.safeParse({ uid: "ZZ11223344" }).success).toBe(false);
  });

  it("validates FSR readings", () => {
    expect(fsrReadingSchema.safeParse({ channel: 4, occupied: true, raw: 4095 }).success).toBe(true);
    expect(fsrReadingSchema.safeParse({ channel: 5, occupied: true }).success).toBe(false);
    expect(fsrReadingSchema.safeParse({ channel: 0, occupied: "yes" }).success).toBe(false);
  });
});

describe("LED frame", () => {
  /** Slot n of the prototype uses LED 2n − 1. */
  const slot = (n: number, ...reasons: HighlightReason[]) => ({
    ledStartIdx: 2 * n - 1,
    ledEndIdx: 2 * n - 1,
    highlights: new Set(reasons),
  });

  it("lights walls white and idle slots off", () => {
    const frame = buildLedFrame(11, [1, 2, 3, 4, 5].map((n) => slot(n)));
    expect(frame.version).toBe(1);
    expect(frame.pixels).toHaveLength(11);
    expect(frame.pixels.filter((_, index) => index % 2 === 0)).toEqual(Array(6).fill(LED_STYLES.WALL));
    expect(frame.pixels.filter((_, index) => index % 2 === 1)).toEqual(Array(5).fill(LED_STYLES.OFF));
  });

  it("shows the strongest highlight of a slot", () => {
    const frame = buildLedFrame(11, [slot(1, "PUT_BACK"), slot(2, "CONFIRMED", "MISPLACED"), slot(3, "PUT_BACK", "LOCATE")]);
    expect(frame.pixels[1]).toEqual(LED_STYLES.PUT_BACK);
    expect(frame.pixels[3]).toEqual(LED_STYLES.MISPLACED);
    expect(frame.pixels[5]).toEqual(LED_STYLES.LOCATE);
  });

  it("ignores LED indexes beyond the strip", () => {
    expect(buildLedFrame(3, [{ ledStartIdx: 1, ledEndIdx: 9, highlights: new Set() }]).pixels).toHaveLength(3);
  });
});
