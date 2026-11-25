/**
 * @packageDocumentation
 * Server entry point: starts the HTTP server and the MQTT bridge of the smart
 * shelf, and handles graceful shutdown.
 */
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { startMqttBridge, type MqttBridge } from "./modules/shelf/mqtt-bridge.js";
import { shelfService } from "./modules/shelf/shelf.service.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`[server] Smart Bookshelf API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

/** MQTT connection to the shelf, or `null` when `MQTT_URL` is not configured. */
const mqttBridge: MqttBridge | null = env.MQTT_URL
  ? startMqttBridge(env.MQTT_URL, env.MQTT_TOPIC_PREFIX, shelfService)
  : null;
if (mqttBridge === null) console.warn("[server] MQTT_URL is not set: smart shelf integration disabled");

/** Expires slot highlights and pending RFID tags once per second. */
const expiryTimer = setInterval(() => {
  shelfService.expire().catch((error: unknown) => console.error("[shelf] Expiry failed:", error));
}, 1000);
expiryTimer.unref();

/**
 * Closes the HTTP server, the MQTT connection and the database pool before exiting.
 *
 * @param signal - The POSIX signal that triggered the shutdown.
 */
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  console.log(`[server] Received ${signal}, shutting down...`);
  clearInterval(expiryTimer);
  server.close();
  await mqttBridge?.stop();
  await prisma.$disconnect();
  process.exit(0);
}

process.once("SIGINT", (signal) => void shutdown(signal));
process.once("SIGTERM", (signal) => void shutdown(signal));
