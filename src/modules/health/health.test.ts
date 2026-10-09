import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import { InMemoryUsersRepository } from "../users/users.repository.memory.js";
import { createTestApp } from "../../test/helpers.js";

describe("GET /api/v1/health", () => {
  it("returns 200 with status payload", async () => {
    const { app } = createTestApp();

    const res = await request(app).get("/api/v1/health").expect(200);

    expect(res.body.data).toMatchObject({
      status: "ok",
      database: "unchecked",
    });
    expect(typeof res.body.data.uptime).toBe("number");
    expect(typeof res.body.data.timestamp).toBe("string");
  });

  it("returns 503 when database is down", async () => {
    const app = createApp({
      usersRepository: new InMemoryUsersRepository(),
      checkDatabase: async () => false,
    });

    const res = await request(app).get("/api/v1/health").expect(503);

    expect(res.body.data).toMatchObject({
      status: "degraded",
      database: "down",
    });
  });
});
