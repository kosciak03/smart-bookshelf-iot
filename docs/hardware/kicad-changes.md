# KiCad PCB – Change Log and Pre-Production To-Do List

Project files: `hardware/Projekt półka/Polka_na_ksiazki/`
(`Polka_na_ksiazki.kicad_sch`, `Polka_na_ksiazki.kicad_pcb`, `Polka_na_ksiazki.kicad_pro`, KiCad 10).

Audit date: 2026-11-24. The audit was based on the actual file contents (custom netlist extraction and
geometric checks), because KiCad was not installed on the audit machine. After applying the changes
below, **re-run ERC and DRC in KiCad** – the reports currently in the folder (`ERC.rpt`, `AAA.rpt`,
`DRC.rpt`, `pp.rpt`) are outdated.

## Confirmed hardware assumptions

| Item | Status |
| --- | --- |
| ESP32 board | 38-pin ESP32-DevKitC layout (ESP32-WROOM-32D), matches footprint `PCM_Espressif:ESP32-DevKitC` (rows 25.4 mm apart) |
| Power supply | Mean Well RS-25-5, output set to a stable 5.0 V |
| LED strip | 11 × WS2812B: `WALL | SLOT1 | WALL | SLOT2 | WALL | SLOT3 | WALL | SLOT4 | WALL | SLOT5 | WALL` |
| FSR sensors | FSR402 modules with on-board pull-down (VCC / GND / AO), powered from **3.3 V** (J1) |
| Level shifter | 4-channel BSS138 I2C module (rows `LV1 LV2 LV GND LV3 LV4` / `HV1 HV2 HV GND HV3 HV4`), channel 3 used |

Schematic and PCB were verified to match 1:1 (16 parts, identical footprints and values, all 17 nets
fully routed, 29 unused pins flagged no-connect). Pinout matches `AGENTS.md` and the backend
(`fsrChannel` 0–4 = `/Czujnik_1..5` = GPIO 34, 35, 32, 33, 36 = J3 pins 1–5).

## Already done (2026-11-24)

A backup of the original files is stored in
`Polka_na_ksiazki-backups/manual-before-claude-2026-11-24/`.

| # | Change | File |
| --- | --- | --- |
| D1 | Removed the dangling 0.3 mm track stub on pad `LV1.6` (net `unconnected-(LV1-Pin_6-Pad6)`) | `.kicad_pcb` |
| D2 | Raised the copper-to-board-edge clearance rule from 0.18 mm to 0.5 mm (`min_copper_edge_clearance`) | `.kicad_pro` |
| D3 | Backend seed: one LED per slot (`ledStartIdx = ledEndIdx = 2n − 1`), wall LEDs at indexes 0, 2, 4, 6, 8, 10 | `backend/src/db/seed-data.ts` |
| D4 | LED layout documented in the hardware pinout section | `AGENTS.md` |
| D5 | Schematic: D1 1N5819 (`+5V` → `+5V_ESP` → `U1.19`), D2 1.5KE6V8A TVS (`+5V`/GND), nets renamed to `LED_DATA_3V3` / `LED_DATA_5V`, `PasekLED1` value `DG301-5.0-03P`, title block filled; ERC 0 errors (`ERC_rev1.1.rpt`) | `.kicad_sch` |
| D6 | PCB: U1 holes 1.0 mm (copper 1.2 × 2.0 kept), D1 at (128.6, 106.5), D2 at (113, 79.5, 90°), +5V rerouted around `U1.19` | `.kicad_pcb` |
| D7 | PCB: rule area "ESP32 antenna keepout" (x 127–156, y 48.5–56, F.Cu + B.Cu, no copper fill) | `.kicad_pcb` |
| D8 | PCB: 12 front silkscreen labels (J1–J3, LED terminal, HV/LV, USB warning, DC jack, RC522) and a title text on B.Silkscreen | `.kicad_pcb` |

| D9 | F1: value `RXEF185`, original 5.0 mm footprint kept (matches the part); polarity marks and capacitor 3D model removed from the board copy (intentional `lib_footprint_mismatch` warning). The `0ZRE0100FF` footprint was rejected (≈10 mm pad pitch) | `.kicad_sch`, `.kicad_pcb` |

DRC after D6–D7: 0 errors, 0 unconnected pads (`DRC_rev1.1.rpt`, only the `PCM_Espressif` library warning).

> D2 only takes effect after the zones are refilled in KiCad (press **B**). Until then the stored
> copper fill still reaches 0.18 mm from the edge.

## To do in KiCad (ordered by priority)

### Critical – must be fixed before ordering the PCB

1. **U1 hole size.** All 38 pads of `U1` (`PCM_Espressif:ESP32-DevKitC`) have a 0.8 mm drill. Standard
   2.54 mm female headers have 0.64 mm square tails (≈ 0.9 mm diagonal) that do not fit.
   - Footprint Editor → all pads: keep the original copper **Size X = 1.2, Size Y = 2** (pads are
     rotated 270°, so X is the length *along* the pin row) and set the hole to **1.0 mm**.
   - Do **not** enlarge Size X: 13 tracks pass *between* U1 pins (1.34 mm gap with 1.2 mm pads).
     Size X = 1.7 was tried on 2026-11-24 and produced 25 DRC errors.
   - Resulting annular ring: 0.5 mm across the row, 0.1 mm along the row. If the PCB manufacturer
     requires ≥ 0.15 mm, use a 0.9 mm hole and check that the header tails fit (diagonal < ~0.85 mm).
   - Do not use *Update Footprints from Library* on U1 afterwards, or the change will be reverted.
2. **USB plug clearance.** The micro-USB end of the DevKitC is at y ≈ 104 mm on the board axis
   x ≈ 141 mm; `HV1` (x = 141.34 mm) and the level-shifter module start at y ≈ 109 mm. A micro-USB plug
   (15–20 mm) cannot be inserted while the module is fitted.
   - **Decision (2026-11-24): keep the layout.** The level-shifter module is socketed, so it is
     removed for USB flashing/debugging; later firmware updates go over Wi-Fi (OTA).
   - Add a silkscreen note next to `LV1`/`HV1`: "Remove module before connecting USB".
   - Firmware must include OTA updates (e.g. ArduinoOTA).
3. **USB back-feed protection.** `U1.19` (5V) is tied directly to `+5V`, so a PC connected over USB
   powers the LED strip (up to ~0.66 A).
   - Add diode **D1 = 1N5819** (anode `+5V`, cathode `U1.19`); create a new net, e.g. `+5V_ESP`.
   - Footprint: `Diode_THT:D_DO-15_P10.16mm_Horizontal` (Diotec 1N5819 is DO-15) or the DO-41 variant
     if you buy a DO-41 part.
4. **Screw terminal for the LED strip (`PasekLED1`).** Footprint is 5.08 mm pitch
   (`TerminalBlock_Phoenix_MKDS-1,5-3-5.08`), while the value/symbol say 3.5 mm.
   - Keep the 5.08 mm footprint; the purchased Degson DG301-5.0-03P (5.0 mm) fits (0.16 mm offset over
     3 pins, 1.3 mm holes).
   - Change the value to `DG301-5.0-03P` and the symbol to a generic `Connector_Generic:Conn_01x03`.

### Electrical / assembly – strongly recommended

5. **ESP32 antenna keep-out.** Both GND pours (F.Cu and B.Cu) cover the area under the WROOM antenna.
   - Place → Rule Area: x ≈ 127–156 mm, y 48.5–58 mm, layers F.Cu + B.Cu, *Keep out copper fill*
     (tracks/vias may stay allowed).
6. **F1 footprint.** `F1` (Polyfuse) uses a capacitor footprint `Capacitor_THT:CP_Radial_D10.0mm_P5.00mm`
   (10 mm circle, "+" mark, capacitor 3D model).
   - Use a non-polarised PTC footprint with **5.0 mm** pitch for Littelfuse RXEF185
     (body 17.5 mm wide, 22.4 mm tall, standing on its leads).
   - The body fits between `J4` and `Zasilanie1` in the current position (≈ y 78.8–96.3 mm, x ± 1.5 mm).
7. **FSR connectors `J1`/`J2`/`J3`.** Each FSR module needs 3 wires (VCC → `J1.n`, GND → `J2.n`,
   AO → `J3.n`).
   - **Decision (2026-11-24): keep JST XH (`B5B-XH-A`)** – no footprint change. Cables: XHP-5 housing
     with SXH contacts on the board side, DuPont female ends on the FSR module side (crimping tool needed).
   - Keep VCC of the modules on **+3.3 V** (never +5 V – the AO output follows VCC).
8. **DC socket footprint.** Verify that `Connector_BarrelJack:BarrelJack_Horizontal` matches the
   datasheet of the purchased PCB socket (DC-005 type) – pin positions and slot sizes.
9. **Reverse-polarity protection (decided: yes).** Add **1.5KE6V8A** TVS between `+5V` and GND right after `F1`
   (cathode to `+5V`); footprint `Diode_THT:D_DO-201AE_P15.24mm_Horizontal`. With a reversed plug the
   diode conducts and `F1` trips.

### Cosmetic / documentation (engineering thesis)

10. **Net names.** Rename `/LV1` → `LED_DATA_3V3` and `/HV1` → `LED_DATA_5V` (they currently equal the
    reference designators and suggest channel 1, while channel 3 is used).
11. **Silkscreen labels.** Add text for: `FSR1…FSR5`, `3V3` (J1), `GND` (J2), `AO` (J3),
    `+5V / DIN / GND` (PasekLED1), `LV 3.3V` / `HV 5V` sides of the level shifter, DC jack polarity,
    pin 1 / orientation of the RC522 header (J4), project name, revision and date.
12. **Text size.** U1 pin labels are 0.7 mm high (32 DRC warnings); enlarge to ≥ 0.8–1.0 mm or accept.
    Move the `PasekLED1` reference off pad `U1.16` and the `Zasilanie1` reference off pad 3.
13. **Title block.** Fill in the schematic title block (title, revision, date, author, university).
14. **Design rules.** Set the board constraints (currently 0) to the capabilities of the chosen PCB
    manufacturer (minimum clearance, track width, annular ring, hole size).
15. **Production files.** `Production/Polka_na_ksiazki_panelized.kicad_pcb` is from 2025-11-06 and is
    outdated (panelizer log reports 0 × 0 mm). Delete it and generate fresh Gerbers, drill files and BOM.

## Final checklist before exporting Gerbers

- [ ] Zones refilled (**B**).
- [ ] ERC: 0 errors.
- [ ] DRC: 0 errors, only accepted warnings left; old `.rpt` files replaced.
- [ ] 3D view checked (add a 3D model for U1 if available).
- [ ] 1:1 paper print checked with the real ESP32 board, level shifter, DC socket, terminal block and PTC.
- [ ] Gerbers, drill files and BOM exported from the current board into `hardware/` (as promised in `README.md`).

## Repository hygiene (`hardware/` is not tracked by Git yet)

Before committing the KiCad project, exclude generated and temporary files, e.g.:

```gitignore
hardware/**/*-backups/
hardware/**/fp-info-cache
hardware/**/*.kicad_prl
hardware/**/*.rar
hardware/**/~*.lck
```

Also consider removing the empty leftover project `Polka_na_ksiazki_pcb/` and renaming the folder
`Projekt półka` to a name without spaces and diacritics (e.g. `hardware/kicad/`).
