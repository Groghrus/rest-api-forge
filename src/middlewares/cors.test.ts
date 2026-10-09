import request from "supertest";
import { describe, expect, it } from "vitest";

import { createTestApp } from "../test/helpers.js";

const ALLOWED = "https://app.example.com";

describe("CORS", () => {
  it("adds CORS headers for an allowed origin", async () => {
    const { app } = createTestApp({ corsOrigins: [ALLOWED] });

    const res = await request(app)
      .get("/api/v1/health")
      .set("Origin", ALLOWED)
      .expect(200);

    expect(res.headers["access-control-allow-origin"]).toBe(ALLOWED);
    expect(res.headers["vary"]).toContain("Origin");
  });

  it("omits CORS headers for a disallowed origin", async () => {
    const { app } = createTestApp({ corsOrigins: [ALLOWED] });

    const res = await request(app)
      .get("/api/v1/health")
      .set("Origin", "https://evil.example.com")
      .expect(200);

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("answers preflight OPTIONS with 204 for an allowed origin", async () => {
    const { app } = createTestApp({ corsOrigins: [ALLOWED] });

    const res = await request(app)
      .options("/api/v1/users")
      .set("Origin", ALLOWED)
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "authorization,content-type")
      .expect(204);

    expect(res.headers["access-control-allow-origin"]).toBe(ALLOWED);
    expect(res.headers["access-control-allow-methods"]).toContain("POST");
    expect(res.headers["access-control-allow-headers"]).toContain(
      "Authorization",
    );
    expect(res.headers["access-control-expose-headers"]).toContain("Location");
    expect(res.headers["access-control-max-age"]).toBe("86400");
  });

  it("answers preflight for a disallowed origin without CORS headers", async () => {
    const { app } = createTestApp({ corsOrigins: [ALLOWED] });

    const res = await request(app)
      .options("/api/v1/users")
      .set("Origin", "https://evil.example.com")
      .set("Access-Control-Request-Method", "POST")
      .expect(204);

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("adds no CORS header when the whitelist is empty", async () => {
    const { app } = createTestApp({ corsOrigins: [] });

    const res = await request(app)
      .get("/api/v1/health")
      .set("Origin", ALLOWED)
      .expect(200);

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it('allows any origin when the whitelist is "*"', async () => {
    const { app } = createTestApp({ corsOrigins: ["*"] });

    const res = await request(app)
      .get("/api/v1/health")
      .set("Origin", "https://any.example.com")
      .expect(200);

    expect(res.headers["access-control-allow-origin"]).toBe("*");
  });

  it("allows requests without an Origin header (server-to-server)", async () => {
    const { app } = createTestApp({ corsOrigins: [ALLOWED] });

    const res = await request(app).get("/api/v1/health").expect(200);

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
