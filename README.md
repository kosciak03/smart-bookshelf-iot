# Smart Bookshelf IoT System

**Design and Implementation of a Smart Bookshelf with Book Identification and Location System**
*B.Sc. engineering thesis project — Silesian University of Technology, Faculty of Automatic Control, Electronics and Computer Science*

## Overview

A web library manager connected to a custom ESP32 shelf. Books are added by
ISBN (typed or scanned from the barcode) or manually; reading progress,
ratings and statistics are tracked in the web app. On the shelf, an RFID
reader identifies books, pressure sensors (FSR) detect whether a slot is
occupied, and an addressable LED strip guides the user: a slot blinks to show
where a book is or where it should be put back.

## Repository structure

| Path | Contents |
| --- | --- |
| `backend/` | Node.js + TypeScript REST API (Express, Prisma, PostgreSQL), MQTT bridge to the shelf, Server-Sent Events, ESP32 simulator |
| `frontend/` | React + TypeScript web app (Vite, Tailwind CSS, TanStack Query) |
| `firmware/` | ESP32 firmware (PlatformIO) |
| `hardware/` | KiCad project of the shelf PCB |
| `mosquitto/` | MQTT broker configuration |
| `docs/` | MQTT protocol, Doxygen configuration, AI usage log |

## Running locally

Requirements: Docker Desktop.

```sh
docker compose up --build
```

| Service | Address |
| --- | --- |
| Web app | http://localhost:5173 |
| API | http://localhost:3000/api |
| MQTT broker | `mqtt://localhost:1883` |

Sample data: `docker compose exec backend npm run db:seed`.
Without the hardware, the shelf can be simulated:
`docker compose exec backend npm run simulator` (see `docs/mqtt-protocol.md`).

## Tests

```sh
docker compose exec backend npm test
docker compose exec frontend npm test
```

## License

MIT — see `LICENSE`.
