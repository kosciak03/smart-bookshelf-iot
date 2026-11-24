# Hardware Shopping List

Prices checked on **2026-11-24** (PLN gross). Prices and stock change – check the links before ordering.
No single Polish shop that was checked stocks every part: **TME** has all electronic components but no
RC522 module, **Botland** has the modules but lacks several components. The list therefore combines
the two shops. Shipping costs were not verified (Botland: free shipping from 500 PLN).

## Already owned

| Part | Notes |
| --- | --- |
| Mean Well RS-25-5 (5 V / 5 A / 25 W) | Output set to 5.0 V. Cover the 230 V terminals and connect the FG (PE) terminal |
| ESP32-DevKitC, 38-pin (ESP32-WROOM-32D) | Matches the PCB footprint |
| 4-channel BSS138 level shifter modules (10 pcs) | One used (channel 3) |
| Resistor 330 Ω | `R1` |
| WS2812B 5050 strip, 5 V | 11 LEDs used |
| Capacitor 1000 µF, radial | `C1` (voltage rating ≥ 10 V recommended) |
| FSR402 modules with pull-down (10 pcs) | 5 used, powered from 3.3 V |

## To buy – TME (electronic components)

| Qty | Part | Link | Unit price | Total |
| --- | --- | --- | --- | --- |
| 5 (MOQ) | PTC fuse Littelfuse RXEF185 (1.85 A hold, 72 V, 5 mm pitch) – `F1` | [tme.eu](https://www.tme.eu/pl/details/rxef185/bezpieczniki-polimerowe-tht/littelfuse/rf2635-000/) | 3.46 | 17.30 |
| 1 | Screw terminal 3-pin, 5.0 mm, Degson DG301-5.0-03P – `PasekLED1` | [tme.eu](https://www.tme.eu/pl/details/dg301-5.0-3p12/listwy-zaciskowe-do-druku/degson-electronics/dg301-5-0-03p-12-00z-h/) | 0.85 | 0.85 |
| 1 | Schottky diode 1N5819 (DO-15) – new `D1` (USB back-feed) | [tme.eu](https://www.tme.eu/pl/details/1n5819-dio/diody-schottky-tht/diotec-semiconductor/1n5819/) | 1.26 | 1.26 |
| 10 | NFC stickers NTAG213 (13.56 MHz, work with RC522, 7-byte UID) – book tags | [tme.eu](https://www.tme.eu/pl/details/rfid-stick-nt213/moduly-i-czytniki-rfid/goodwin/nfc-sticker-213/) | 2.46 | 24.60 |
| 1 | *(optional)* TVS diode 1.5KE6V8A – reverse-polarity protection | [tme.eu](https://www.tme.eu/pl/details/1.5ke6v8a-st/diody-tvs-tht-jednokierunkowe/stmicroelectronics/1-5ke6v8a/) | not verified | – |
| | **FSR connectors – Option A only (JST XH, needs a crimping tool):** | | | |
| 3 | JST B5B-XH-A header, 5-pin – `J1`, `J2`, `J3` | [tme.eu](https://www.tme.eu/pl/details/b5b-xh-a/zlacza-sygnalowe-raster-2-50mm/jst/b5b-xh-a-lf-sn/) | 0.56 | 1.68 |
| 3 | JST XHP-5 housing | [tme.eu](https://www.tme.eu/pl/details/xhp-5/zlacza-sygnalowe-raster-2-50mm/jst/) | 0.28 | 0.84 |
| 15 | JST SXH-001T-P0.6 crimp contact | [tme.eu](https://www.tme.eu/pl/details/sxh-001t-p0.6/zlacza-sygnalowe-raster-2-50mm/jst/) | 0.16 | 2.40 |

**TME subtotal:** 44.01 PLN without the JST parts (Option B) or 48.93 PLN with them (Option A),
plus the optional TVS and shipping.

## To buy – Botland (modules and accessories)

| Qty | Part | Link | Price | Total |
| --- | --- | --- | --- | --- |
| 1 | RC522 RFID reader 13.56 MHz + card + key fob – `J4` | [botland.com.pl](https://botland.com.pl/moduly-i-tagi-rfid/6765-modul-rfid-mf-rc522-1356mhz-spi-karta-i-brelok-5904422335014.html) | 11.90 | 11.90 |
| 1 pack | Female header 1x40, 2.54 mm (10 pcs) – cut to 2× 1x19 (`U1`), 2× 1x6 (`LV1`, `HV1`), 1× 1x8 (`J4`) | [botland.com.pl](https://botland.com.pl/gniazda-szpilkowe-goldpin/20029-listwa-goldpin-1x40-zenska-raster-254mm-10szt-justpi-5904422329174.html) | 9.90 | 9.90 |
| 1 | DC plug 5.5/2.1 mm with screw terminals (PSU cable side) | [botland.com.pl](https://botland.com.pl/szybkozlacza/1590-wtyk-dc-5521mm-z-szybkozlaczem-5904422308810.html) | 1.90 | 1.90 |
| 1 pack | Nylon standoffs M3, 10 mm (10 pcs) – mounting holes `H1`–`H4` | [botland.com.pl](https://botland.com.pl/dystanse/11160-dystans-nylonowy-10mm-z-gwintem-m3-10szt-5904422317300.html) | 3.90 | 3.90 |
| 1 pack | DuPont wires female–female, 20 cm (40 pcs) – FSR modules (Option B) | [botland.com.pl](https://botland.com.pl/przewody-polaczeniowe-zensko-zenskie/19620-zestaw-przewodow-polaczeniowych-justpi-zensko-zenskie-20cm-40szt-5903351243032.html) | 6.50 | 6.50 |

**Botland subtotal:** 34.10 PLN plus shipping.

## Still to source (not price-verified)

| Qty | Part | Notes |
| --- | --- | --- |
| 1 | DC socket 5.5 × 2.1 mm, **PCB-mount horizontal** (DC-005 type) – `Zasilanie1` | Search "DC-005" at TME/Botland. Botland lists one on its English store ([#411](https://botland.store/411-dc-connector-55x21mm-for-printing-horizontal.html)), but it did not appear in the Polish search. The TME VG18035A is a panel socket and does **not** fit the PCB footprint |
| 4 | M3 × 6 mm screws (or a nylon M3 screw/standoff kit, e.g. Botland JUS-24710, 33.70 PLN) | For the standoffs |
| 1 | Mains cable with plug and bare wire ends, 3-core | For the RS-25-5 (L, N, PE). Any electrical shop, or cut an IEC cable |
| 1 | Crimping tool for JST XH (2.5 mm, SXH contacts) | Required (Option A chosen) |
| 1 set | PCB manufacturing (2 layers, 67.5 × 80 mm) | Separate order after the KiCad fixes |

## Decisions (2026-11-24)

- **FSR connectors: Option A – JST XH (current PCB).** Buy the three JST lines in the TME table, the
  TVS diode and a JST XH crimping tool. Cut DuPont female–female wires in half: the female end goes on
  the FSR module, the bare end is crimped into an SXH contact. Male headers (Option B) are not needed.
- **TVS diode: yes** – buy the 1.5KE6V8A.
- **USB:** no extra parts; the level-shifter module is removed for USB flashing.

## Estimated total (without shipping and PCB manufacturing)

| Shop | Chosen configuration (JST XH, TVS) |
| --- | --- |
| TME | 48.93 PLN + TVS (price not verified) |
| Botland | 34.10 PLN (DuPont wires used for the FSR cables) |
| **Total** | **≈ 83 PLN + TVS + crimping tool** |

Not included: DC PCB socket, screws, mains cable, crimping tool, shipping, PCB manufacturing.
