import request from "supertest";
import { describe, expect, it } from "vitest";

import { createTestApp } from "./test/helpers.js";

describe("cross-cutting HTTP behaviour", () => {
  it("unknown route → 404 in RFC 9457 problem format", async () => {
    const { app } = createTestApp();

    const res = await request(app).get("/api/v1/nope").expect(404);

    expect(res.headers["content-type"]).toContain("application/problem+json");
    expect(res.body).toMatchObject({
      status: 404,
      title: "Not Found",
      instance: "/api/v1/nope",
    });
    expect(res.body.type).toContain("/problems/not-found");
  });

  it("malformed JSON body → 400 problem+json", async () => {
    const { app } = createTestApp();

    const res = await request(app)
      .post("/api/v1/auth/login")
      .set("Content-Type", "application/json")
      .send("{ this is not json")
      .expect(400);

    expect(res.headers["content-type"]).toContain("application/problem+json");
    expect(res.body.detail).toBe("Malformed JSON body");
  });

  it("protected route without token → 401 problem+json", async () => {
    const { app } = createTestApp();

    const res = await request(app).get("/api/v1/users").expect(401);

    expect(res.headers["content-type"]).toContain("application/problem+json");
    expect(res.body.type).toContain("/problems/unauthorized");
  });

  it("does not expose x-powered-by header", async () => {
    const { app } = createTestApp();

    const res = await request(app).get("/api/v1/health").expect(200);

    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("serves OpenAPI document generated from Zod schemas", async () => {
    const { app } = createTestApp();

    const res = await request(app).get("/api/v1/openapi.json").expect(200);

    expect(res.body.openapi).toBe("3.1.0");
    expect(Object.keys(res.body.paths)).toContain("/users");
    expect(Object.keys(res.body.paths)).toContain("/auth/login");
    expect(res.body.components.securitySchemes.bearerAuth).toMatchObject({
      type: "http",
      scheme: "bearer",
    });
  });

  it("serves Swagger UI at /api/v1/docs", async () => {
    const { app } = createTestApp();

    const res = await request(app).get("/api/v1/docs").expect(200);

    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.text).toContain("swagger-ui");
  });
});
