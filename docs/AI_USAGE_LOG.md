# AI Tools Usage Log (Rejestr wykorzystania narzędzi AI - Wydział AEiI PŚ)

Zgodnie z Zarządzeniem nr 5/2026 Rektora Politechniki Śląskiej z dnia 15 stycznia 2026 r. (§ 4 pkt 6 oraz pkt 9) oraz wytycznymi Wydziału AEiI, poniższy rejestr dokumentuje zakres wykorzystania narzędzi AI w trakcie realizacji projektu oraz redakcji pracy inżynierskiej.

| Data | Narzędzie AI | Moduł / Element pracy | Zakres i cel użycia | Zastosowany prompt (skrót) | Zakres modyfikacji autora (bez zmian / zmodyfikowano) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2026-11-13 | Google Gemini | Architektura projektu / Setup | Konfiguracja struktury Monorepo, pliku `AGENTS.md`, `docker-compose.yml` oraz szkieletu `schema.prisma` | Konfiguracja środowiska VS Code i architektury systemu Smart Bookshelf IoT | Zmodyfikowano i zweryfikowano przez autora pod kątem pinoutu własnego PCB |
| 2026-11-23 | Claude Code (Claude Opus 5.5) | Etap 1 – baza danych | Poprawki schematu Prisma (enum zdarzeń, pola czytania i wydania, kanały FSR, relacje), ręczne ograniczenia CHECK w migracji, automatyczne migracje przy starcie kontenera, idempotentny skrypt seed | Realizacja Etapu 1: poprawki schema.prisma, pierwsza migracja i seed | Zweryfikowano przez autora (migracja w Dockerze, dwukrotny seed, test ograniczeń CHECK) |
| 2026-11-23 | Claude Code (Claude Opus 5.5) | Etap 2 – CRUD książek i walidacja | Endpointy REST /api/books z paginacją i sortowaniem, schematy Zod, normalizacja ISBN, centralna obsługa błędów (400/404/409), testy Vitest + Supertest na osobnej bazie testowej, przykłady żądań REST Client | Realizacja Etapu 2: CRUD książek, walidacja Zod, obsługa błędów i testy | Zweryfikowano przez autora (testy w Dockerze i z hosta, ręczne żądania .http/curl) |
