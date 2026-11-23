# Smart Bookshelf IoT System

**Design and Implementation of a Smart Bookshelf with Book Identification and Location System**  
*B.Sc. Engineering Thesis Project — Silesian University of Technology (Faculty of Automatic Control, Electronics and Computer Science)*

## Overview
An IoT system combining a Goodreads-inspired web library manager with custom ESP32-based shelf hardware. Users can catalog books via ISBN barcode scanning or search, assign them to physical shelf slots using RFID stickers, locate titles via addressable RGB LEDs, and track real-time book presence using Force Sensitive Resistors (FSR).

## Repository Structure
- `hardware/` — KiCad schematic, PCB layout, BOM, and Gerber files.
- `firmware/` — ESP32 C++ firmware (PlatformIO) with Doxygen documentation.
- `backend/` — Node.js + TypeScript REST/WebSocket API with Prisma ORM and PostgreSQL.
- `frontend/` — React + TypeScript web application.
- `docs/` — Architecture diagrams, Doxygen configuration, and AI usage log.
