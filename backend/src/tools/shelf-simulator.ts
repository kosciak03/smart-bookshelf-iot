/**
 * @packageDocumentation
 * Command-line simulator of the ESP32 smart shelf. It speaks the same MQTT
 * protocol as the firmware (see `docs/mqtt-protocol.md`), so the backend and
 * the web app can be developed and demonstrated without the hardware.
 *
 * Usage (inside the backend container):
 * ```sh
 * npm run simulator                       # interactive
 * npm run simulator -- "scan 04A1B2C3D4E505; place 5"   # scripted, then exits
 * ```
 * Environment: `MQTT_URL` (default `mqtt://localhost:1883`), `MQTT_TOPIC_PREFIX`,
 * `SHELF_NUMBER` (default 1).
 *
 * Commands: `place <slot>`, `remove <slot>`, `scan <uid>`, `state`,
 * `offline`, `online`, `help`, `quit`. Slot `n` uses FSR channel `n - 1`
 * (wiring of the prototype PCB and the seed data).
 */
import { createInterface } from "node:readline/promises";
import { connect } from "mqtt";
import { shelfTopic, type LedFrame } from "../modules/shelf/shelf.protocol.js";

const url = process.env.MQTT_URL || "mqtt://localhost:1883";
const prefix = process.env.MQTT_TOPIC_PREFIX || "smartbookshelf";
const shelfNumber = Number(process.env.SHELF_NUMBER || 1);
const SLOT_COUNT = 5;
const FIRMWARE = "simulator-1.0.0";

const topic = (kind: "status" | "fsr" | "rfid" | "leds") => shelfTopic(prefix, shelfNumber, kind);

/** Simulated FSR state per channel. */
const occupied: boolean[] = Array.from({ length: SLOT_COUNT }, () => false);

const client = connect(url, {
  clientId: `shelf-simulator-${shelfNumber}-${process.pid}`,
  clean: true,
  // Same Last Will as the firmware: the broker announces the device offline.
  will: { topic: topic("status"), payload: Buffer.from(JSON.stringify({ online: false })), qos: 1, retain: true },
});

/**
 * Publishes a JSON message.
 *
 * @param kind - Message kind.
 * @param payload - JSON payload.
 * @param retain - Retain flag.
 */
function send(kind: "status" | "fsr" | "rfid", payload: unknown, retain = false): Promise<void> {
  return new Promise((resolve, reject) => {
    client.publish(topic(kind), JSON.stringify(payload), { qos: 1, retain }, (error) => (error ? reject(error) : resolve()));
  });
}

/**
 * Renders an LED frame as coloured blocks (24-bit ANSI colours).
 *
 * @param frame - Frame received from the backend.
 */
function renderFrame(frame: LedFrame): string {
  const blocks = frame.pixels.map((pixel) => {
    const [r, g, b] = [1, 3, 5].map((offset) => parseInt(pixel.color.slice(offset, offset + 2), 16));
    const off = r === 0 && g === 0 && b === 0;
    const glyph = off ? " · " : pixel.effect === "blink" ? " * " : "   ";
    return off ? `\x1b[48;2;40;40;40m\x1b[37m${glyph}\x1b[0m` : `\x1b[48;2;${r};${g};${b}m\x1b[30m${glyph}\x1b[0m`;
  });
  const legend = frame.pixels
    .map((pixel, index) => (pixel.color === "#FFFFFF" ? null : `#${index}=${pixel.color}${pixel.effect === "blink" ? " blink" : ""}`))
    .filter((entry) => entry !== null && !entry.includes("#000000"));
  return `LEDs ${blocks.join("")}  ${legend.length > 0 ? legend.join(", ") : "(slots off)"}`;
}

/** Prints the simulated sensor state. */
function printState(): void {
  console.log(`FSR  ${occupied.map((value, index) => `slot ${index + 1}: ${value ? "■ book" : "□ empty"}`).join(" | ")}`);
}

/**
 * Parses a slot number argument.
 *
 * @param value - Command argument.
 * @returns The FSR channel, or `null` when invalid.
 */
function channelOf(value: string | undefined): number | null {
  const slot = Number(value);
  return Number.isInteger(slot) && slot >= 1 && slot <= SLOT_COUNT ? slot - 1 : null;
}

/**
 * Executes one simulator command.
 *
 * @param line - Command line.
 * @returns `false` when the simulator should exit.
 */
async function run(line: string): Promise<boolean> {
  const [command = "", argument] = line.trim().split(/\s+/);
  switch (command.toLowerCase()) {
    case "":
      return true;
    case "place":
    case "remove": {
      const channel = channelOf(argument);
      if (channel === null) {
        console.log(`Usage: ${command} <slot 1-${SLOT_COUNT}>`);
        return true;
      }
      occupied[channel] = command === "place";
      await send("fsr", { channel, occupied: occupied[channel], raw: occupied[channel] ? 2300 : 40 });
      console.log(`→ FSR channel ${channel} (slot ${channel + 1}) ${occupied[channel] ? "occupied" : "empty"}`);
      return true;
    }
    case "scan":
      if (!argument) {
        console.log("Usage: scan <uid>   (e.g. scan 04A1B2C3D4E501 — Clean Code in the seed data)");
        return true;
      }
      await send("rfid", { uid: argument });
      console.log(`→ RFID ${argument.toUpperCase()}`);
      return true;
    case "state":
      printState();
      return true;
    case "offline":
      await send("status", { online: false }, true);
      console.log("→ status offline");
      return true;
    case "online":
      await announce();
      return true;
    case "help":
      console.log("Commands: place <slot>, remove <slot>, scan <uid>, state, offline, online, quit");
      return true;
    case "quit":
    case "exit":
      return false;
    default:
      console.log(`Unknown command '${command}'. Type 'help'.`);
      return true;
  }
}

/** Announces the device and its sensor states, like the firmware after connecting. */
async function announce(): Promise<void> {
  await send("status", { online: true, firmware: FIRMWARE, ip: "127.0.0.1", rssi: -55 }, true);
  for (const [channel, value] of occupied.entries()) await send("fsr", { channel, occupied: value, raw: value ? 2300 : 40 });
  console.log(`→ status online (${FIRMWARE}), ${SLOT_COUNT} FSR channels reported`);
}

client.on("message", (_topic, payload) => {
  try {
    console.log(renderFrame(JSON.parse(payload.toString()) as LedFrame));
  } catch {
    console.log("! Invalid LED frame received");
  }
});

client.on("error", (error) => console.error(`MQTT error: ${error.message}`));

client.once("connect", async () => {
  console.log(`Shelf simulator connected to ${url} as shelf ${shelfNumber}. Type 'help' for commands.`);
  client.subscribe(topic("leds"), { qos: 1 });
  await announce();

  const script = process.argv.slice(2).join(" ").trim();
  if (script !== "") {
    for (const command of script.split(";")) {
      console.log(`> ${command.trim()}`);
      await run(command);
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
    await new Promise((resolve) => setTimeout(resolve, 600));
    client.end(false, {}, () => process.exit(0));
    return;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: "shelf> " });
  rl.prompt();
  for await (const line of rl) {
    if (!(await run(line))) break;
    rl.prompt();
  }
  // A clean exit is an intentional shutdown: announce offline like the firmware would.
  await send("status", { online: false }, true);
  client.end(false, {}, () => process.exit(0));
});
