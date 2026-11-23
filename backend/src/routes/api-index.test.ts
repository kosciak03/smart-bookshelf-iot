/**
 * @packageDocumentation
 * Tests for the API entry point (`GET /api`).
 */
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";

const app = createApp();

describe("GET /api", () => {
  it("returns the API name, version and endpoint list", async () => {
    const response = await request(app).get("/api").expect(200);

    expect(response.body.name).toBe("Smart Bookshelf API");
    expect(response.body.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(response.body.endpoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: "GET", path: "/api/health" }),
        expect.objectContaining({ method: "POST", path: "/api/books" }),
      ]),
    );
  });

  it("also answers with a trailing slash", async () => {
    await request(app).get("/api/").expect(200);
  });
});
