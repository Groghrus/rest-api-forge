import request from "supertest";
import { describe, expect, it } from "vitest";

import { createTestApp } from "../test/helpers.js";

const CREDENTIALS = { email: "nobody@example.com", password: "password123" };

describe("rate limiting on /auth/*", () => {
  it("returns 429 problem+json once the limit is exceeded", async () => {
    const { app } = createTestApp({
      authRateLimit: { windowMs: 60_000, max: 2 },
    });

    await request(app).post("/api/v1/auth/login").send(CREDENTIALS).expect(401);
    await request(app).post("/api/v1/auth/login").send(CREDENTIALS).expect(401);

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send(CREDENTIALS)
      .expect(429);

    expect(res.headers["content-type"]).toContain("application/problem+json");
    expect(res.body).toMatchObject({
      status: 429,
      title: "Too Many Requests",
    });
    expect(res.body.type).toContain("/problems/too-many-requests");
  });

  it("sends rate-limit headers on successful responses", async () => {
    const { app } = createTestApp({
      authRateLimit: { windowMs: 60_000, max: 5 },
    });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send(CREDENTIALS)
      .expect(401);

    expect(
      res.headers["ratelimit"] ?? res.headers["ratelimit-policy"],
    ).toBeDefined();
  });

  it("does not affect routes outside /auth", async () => {
    const { app } = createTestApp({
      authRateLimit: { windowMs: 60_000, max: 1 },
    });

    await request(app).post("/api/v1/auth/login").send(CREDENTIALS).expect(401);

    await request(app).get("/api/v1/health").expect(200);
    await request(app).get("/api/v1/health").expect(200);
  });

  it("is disabled by default in the test environment", async () => {
    const { app } = createTestApp();

    for (let attempt = 0; attempt < 15; attempt++) {
      await request(app)
        .post("/api/v1/auth/login")
        .send(CREDENTIALS)
        .expect(401);
    }
  });
});
