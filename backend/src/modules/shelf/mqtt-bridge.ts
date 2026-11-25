/**
 * @packageDocumentation
 * Connection between the MQTT broker and the {@link ShelfService}: subscribes
 * to the device topics, forwards messages and publishes LED frames.
 *
 * The client reconnects automatically; while the broker is unreachable the
 * REST API keeps working and the shelf state reports `broker.connected: false`.
 */
import { randomUUID } from "node:crypto";
import { connect, type MqttClient } from "mqtt";
import { inboundTopicFilters } from "./shelf.protocol.js";
import type { ShelfService } from "./shelf.service.js";

/** Handle returned by {@link startMqttBridge}. */
export interface MqttBridge {
  /** Disconnects from the broker. */
  stop(): Promise<void>;
}

/**
 * Connects to the broker and wires it to the shelf service.
 *
 * @param url - Broker URL, e.g. `mqtt://mosquitto:1883`.
 * @param prefix - Topic prefix.
 * @param service - Shelf service receiving the messages.
 * @returns A handle to stop the bridge.
 */
export function startMqttBridge(url: string, prefix: string, service: ShelfService): MqttBridge {
  const client: MqttClient = connect(url, {
    clientId: `smart-bookshelf-api-${randomUUID().slice(0, 8)}`,
    reconnectPeriod: 5000,
    connectTimeout: 10_000,
    clean: true,
  });

  client.on("connect", () => {
    console.log(`[mqtt] Connected to ${url}`);
    client.subscribe(inboundTopicFilters(prefix), { qos: 1 }, (error) => {
      if (error) console.error("[mqtt] Subscribe failed:", error.message);
    });
    service.setPublisher({
      publish: (topic, payload, options) => {
        client.publish(topic, payload, options, (error) => {
          if (error) console.error(`[mqtt] Publish to ${topic} failed:`, error.message);
        });
      },
    });
    void service.republishAll().catch((error: unknown) => console.error("[mqtt] Republishing LED state failed:", error));
  });

  client.on("message", (topic, payload) => {
    void service.handleMessage(topic, payload);
  });

  client.on("close", () => {
    if (service.connected) console.warn("[mqtt] Connection to the broker lost, reconnecting…");
    service.setPublisher(null);
  });

  client.on("error", (error) => {
    console.error("[mqtt] Error:", error.message);
  });

  return {
    stop: () =>
      new Promise((resolve) => {
        service.setPublisher(null);
        client.end(false, {}, () => resolve());
      }),
  };
}
