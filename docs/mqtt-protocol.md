# MQTT protocol: smart shelf ↔ backend

The ESP32 shelf and the backend communicate only through an MQTT broker
(Eclipse Mosquitto 2, service `mosquitto` in `docker-compose.yml`, port 1883).
The device never calls the REST API, and the backend never connects to the
device directly. Either side can restart without the other.

Reference implementation of the device side: `backend/src/tools/shelf-simulator.ts`
(`npm run simulator`). Server side: `backend/src/modules/shelf/`.

## Topics

`<prefix>` is `MQTT_TOPIC_PREFIX` (default `smartbookshelf`). `<n>` is the shelf
number (the prototype is shelf `1`).

| Topic                       | Direction       | QoS | Retained | Payload                      |
| --------------------------- | --------------- | --- | -------- | ---------------------------- |
| `<prefix>/shelf/<n>/status` | device → server | 1   | yes      | [status](#status)            |
| `<prefix>/shelf/<n>/fsr`    | device → server | 1   | no       | [fsr](#fsr)                  |
| `<prefix>/shelf/<n>/rfid`   | device → server | 1   | no       | [rfid](#rfid)                |
| `<prefix>/shelf/<n>/leds`   | server → device | 1   | yes      | [leds](#leds)                |

All payloads are UTF-8 JSON objects. The server validates every message with
zod. Invalid messages are logged and ignored, so a firmware bug cannot crash
the server.

The device knows only **hardware channels**: FSR channel 0–4 and LED indexes
0–10. The mapping of channels to shelf slots is stored in the database
(`ShelfSlot.fsrChannel`, `ledStartIdx`, `ledEndIdx`), so re-wiring a slot needs
no firmware change.

## Device → server

### status

Published **retained** right after connecting:

```json
{ "online": true, "firmware": "1.0.0", "ip": "192.168.1.50", "rssi": -61 }
```

The device must register the same topic as its **Last Will** with payload
`{ "online": false }`, retained, QoS 1. The broker then announces a lost
device by itself (power cut, Wi-Fi loss). Only `online` is required.

### fsr

Sent when a pressure sensor **changes** state, after debouncing in the
firmware. Right after connecting, the device sends the current state of
**every** channel so the server can resynchronize. Repeated states are
ignored by the server.

```json
{ "channel": 2, "occupied": true, "raw": 2310 }
```

| Field      | Type         | Description                                             |
| ---------- | ------------ | ------------------------------------------------------- |
| `channel`  | int 0–4      | FSR channel: GPIO 34, 35, 32, 33, 36                    |
| `occupied` | bool         | Result of the threshold with hysteresis in the firmware |
| `raw`      | int 0–4095   | Optional raw ADC value (stored with the event)          |

### rfid

Sent once per tag presentation. The firmware suppresses repeats of the same
UID for about 2 s.

```json
{ "uid": "04A1B2C3D4E501" }
```

The UID is hex, 4, 7 or 10 bytes. Separators (`:`, `-`, spaces) and lower
case are accepted and normalized to upper case without separators.

## Server → device

### leds

The complete state of the strip, published **retained** whenever it changes.
After a reboot the device receives it immediately on subscribing.

```json
{
  "version": 1,
  "pixels": [
    { "color": "#FFFFFF", "effect": "solid" },
    { "color": "#00C853", "effect": "blink" },
    { "color": "#FFFFFF", "effect": "solid" },
    { "color": "#000000", "effect": "solid" }
  ]
}
```

- `pixels[i]` drives LED `i`. The length is `SHELF_LED_COUNT`: 11 on the
  prototype, laid out as `WALL | SLOT1 | WALL | … | SLOT5 | WALL`.
- `effect`:
  - `solid`: constant colour,
  - `blink`: the firmware toggles the colour on and off, about 2 Hz, using
    `millis()`, never `delay()`.
- Global brightness is a firmware setting, because the PSU budget is limited.

| Slot state | Colour    | Effect | Meaning                                          |
| ---------- | --------- | ------ | ------------------------------------------------ |
| wall       | `#FFFFFF` | solid  | Separator between slots                          |
| idle       | `#000000` | solid  | Off                                              |
| LOCATE     | `#0091EA` | blink  | "Your book is here" (requested in the web app)   |
| PUT_BACK   | `#00C853` | blink  | "Put the scanned book here"                      |
| MISPLACED  | `#FF1744` | blink  | "Wrong slot": take the book out                  |
| CONFIRMED  | `#00C853` | solid  | 3 s confirmation after a correct placement       |

When several states apply to one slot, the strongest is shown:
MISPLACED > LOCATE > PUT_BACK > CONFIRMED.

## Server behaviour (summary)

| Input                                    | Effect                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| RFID of a known book                     | Its slot blinks PUT_BACK for 60 s. A book without a slot gets the first free slot. The book is expected for 60 s |
| FSR occupied in the expected slot        | Book `ON_SHELF`, CONFIRMED for 3 s                                                          |
| FSR occupied in another slot (expected)  | `MISPLACED` event. That slot blinks red until the book is taken out                         |
| FSR occupied (nothing expected)          | The slot's assigned book becomes `ON_SHELF`                                                 |
| FSR empty                                | The slot's book becomes `OFF_SHELF`. LOCATE on that slot ends (the book was found)          |
| RFID of an unknown tag                   | Kept for 10 min as the *pending tag*, ready to be linked to a book in the web app           |
| `POST /api/books/:id/locate`             | LOCATE for 60 s                                                                            |

Every step is stored in `ShelfEvent` (`GET /api/shelf/events`). Timeouts are
configured with `SHELF_HIGHLIGHT_SECONDS` and `SHELF_EXPECT_SECONDS`.

## Trying it without hardware

```sh
docker compose up -d
docker compose exec backend npm run simulator
shelf> scan 04A1B2C3D4E501   # Clean Code (seed data) → slot 1 blinks green
shelf> place 2               # wrong slot → slot 2 blinks red
shelf> remove 2
shelf> place 1               # confirmed
```

Messages can also be watched directly on the broker:

```sh
docker compose exec mosquitto mosquitto_sub -v -t 'smartbookshelf/#'
```

## Security note

The development broker allows anonymous clients and listens on the LAN. For
anything beyond a trusted home network, configure a password file
(`mosquitto_passwd`), set `allow_anonymous false` and use TLS on port 8883.
The backend accepts `mqtts://` URLs.
