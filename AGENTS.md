# Project: Smart Bookshelf IoT System

## General Rules
1. **Language:** All code, variable names, comments, commit messages, and documentation in this repository MUST be written in **English**.
2. **Documentation:** Every function, class, and module in `firmware/` must include **Doxygen-style comments** (`/** @brief ... */`). Every module/service in `backend/` and `frontend/` must use **TSDoc comments**.
3. **Commit Convention:** Follow **Conventional Commits v1.0.0** (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
4. **Architecture:** Monorepo consisting of `firmware/` (ESP32 C++), `backend/` (Node.js/TypeScript + PostgreSQL/Prisma), and `frontend/` (React/TypeScript).
5. **Shelf communication:** The ESP32 and the backend talk only over MQTT (Mosquitto). Topics and payloads are specified in `docs/mqtt-protocol.md`; firmware and `backend/src/modules/shelf/` must follow it.

## Hardware Pinout (ESP32-DevKitC - Custom PCB)
- **LED Strip (WS2812B via 3.3V->5V level shifter + 330R resistor):** `GPIO 13`
  - 11 LEDs: `WALL | SLOT1 | WALL | SLOT2 | WALL | SLOT3 | WALL | SLOT4 | WALL | SLOT5 | WALL`
  - Wall LEDs (indexes `0, 2, 4, 6, 8, 10`) are static white; slot `n` uses LED index `2n - 1` (state colour).
- **RFID Reader (MFRC522 over SPI):**
  - `SDA (CS)`: `GPIO 5`
  - `SCK`: `GPIO 18`
  - `MISO`: `GPIO 19`
  - `MOSI`: `GPIO 23`
  - `RST`: `GPIO 22`
- **Pressure Sensors (FSR - Analog ADC1 channels):**
  - `FSR_1`: `GPIO 34`
  - `FSR_2`: `GPIO 35`
  - `FSR_3`: `GPIO 32`
  - `FSR_4`: `GPIO 33`
  - `FSR_5`: `GPIO 36` (SENSOR_VP)

## Coding Standards
- **Firmware (C++ / PlatformIO):** Avoid blocking `delay()` in the main loop; use `millis()` state machines. Use `ArduinoJson` for serialization.
- **Backend (TypeScript):** Strict mode enabled (`"strict": true`). Validate all incoming payloads with `zod`.
- **Frontend (React + TypeScript):** Functional components, Tailwind CSS, clean Goodreads-inspired UI.
