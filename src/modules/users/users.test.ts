import { randomUUID } from "node:crypto";

import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  bearer,
  createTestApp,
  loginAs,
  registerUser,
  seedAdmin,
  type TestContext,
} from "../../test/helpers.js";

describe("users CRUD", () => {
  let ctx: TestContext;
  let adminToken: string;

  beforeEach(async () => {
    ctx = createTestApp();
    await seedAdmin(ctx);
    adminToken = await loginAs(ctx.app, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  it("admin creates a user → 201 + Location, password never leaked", async () => {
    const res = await request(ctx.app)
      .post("/api/v1/users")
      .set(bearer(adminToken))
      .send({
        email: "alice@example.com",
        name: "Alice",
        password: "password123",
      })
      .expect(201);

    expect(res.headers.location).toBe(`/api/v1/users/${res.body.data.id}`);
    expect(res.body.data).toMatchObject({
      email: "alice@example.com",
      name: "Alice",
      role: "user",
    });
    expect(JSON.stringify(res.body)).not.toContain("password");
  });

  it("duplicate email → 409 problem+json", async () => {
    await request(ctx.app)
      .post("/api/v1/users")
      .set(bearer(adminToken))
      .send({ email: "bob@example.com", name: "Bob", password: "password123" })
      .expect(201);

    const res = await request(ctx.app)
      .post("/api/v1/users")
      .set(bearer(adminToken))
      .send({
        email: "bob@example.com",
        name: "Bobby",
        password: "password123",
      })
      .expect(409);

    expect(res.headers["content-type"]).toContain("application/problem+json");
    expect(res.body.type).toContain("/problems/conflict");
  });

  it("weak password → 400 with invalidParams", async () => {
    const res = await request(ctx.app)
      .post("/api/v1/users")
      .set(bearer(adminToken))
      .send({ email: "weak@example.com", name: "Weak", password: "12345" })
      .expect(400);

    expect(res.body.detail).toBe("Request validation failed");
    expect(res.body.invalidParams).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "password" })]),
    );
  });

  it("list: 401 without token, 403 for non-admin, 200 for admin", async () => {
    await request(ctx.app).get("/api/v1/users").expect(401);

    const { token } = await registerUser(ctx.app);
    await request(ctx.app).get("/api/v1/users").set(bearer(token)).expect(403);

    const res = await request(ctx.app)
      .get("/api/v1/users")
      .set(bearer(adminToken))
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toMatchObject({ page: 1, perPage: 20 });
  });

  it("list paginates with meta", async () => {
    await registerUser(ctx.app);
    await registerUser(ctx.app);

    const res = await request(ctx.app)
      .get("/api/v1/users?page=2&perPage=2")
      .set(bearer(adminToken))
      .expect(200);

    expect(res.body.meta).toMatchObject({
      page: 2,
      perPage: 2,
      total: 3,
      totalPages: 2,
    });
    expect(res.body.data).toHaveLength(1);
  });

  it("get: owner can read, stranger gets 403, unknown id 404, bad id 400", async () => {
    const owner = await registerUser(ctx.app);
    const stranger = await registerUser(ctx.app);

    const ok = await request(ctx.app)
      .get(`/api/v1/users/${owner.userId}`)
      .set(bearer(owner.token))
      .expect(200);
    expect(ok.body.data.id).toBe(owner.userId);

    await request(ctx.app)
      .get(`/api/v1/users/${owner.userId}`)
      .set(bearer(stranger.token))
      .expect(403);

    const missing = await request(ctx.app)
      .get(`/api/v1/users/${randomUUID()}`)
      .set(bearer(stranger.token))
      .expect(404);
    expect(missing.body.type).toContain("/problems/not-found");

    const invalid = await request(ctx.app)
      .get("/api/v1/users/not-a-uuid")
      .set(bearer(stranger.token))
      .expect(400);
    expect(invalid.body.invalidParams[0].path).toBe("id");
  });

  it("patch: owner updates name, non-admin cannot change role", async () => {
    const owner = await registerUser(ctx.app);

    const updated = await request(ctx.app)
      .patch(`/api/v1/users/${owner.userId}`)
      .set(bearer(owner.token))
      .send({ name: "New Name" })
      .expect(200);
    expect(updated.body.data.name).toBe("New Name");

    const forbidden = await request(ctx.app)
      .patch(`/api/v1/users/${owner.userId}`)
      .set(bearer(owner.token))
      .send({ role: "admin" })
      .expect(403);
    expect(forbidden.body.type).toContain("/problems/forbidden");
  });

  it("patch: email conflict → 409, empty body → 400", async () => {
    await registerUser(ctx.app, { email: "taken@example.com" });
    const owner = await registerUser(ctx.app);

    await request(ctx.app)
      .patch(`/api/v1/users/${owner.userId}`)
      .set(bearer(owner.token))
      .send({ email: "taken@example.com" })
      .expect(409);

    await request(ctx.app)
      .patch(`/api/v1/users/${owner.userId}`)
      .set(bearer(owner.token))
      .send({})
      .expect(400);
  });

  it("admin can change roles", async () => {
    const user = await registerUser(ctx.app);

    const res = await request(ctx.app)
      .patch(`/api/v1/users/${user.userId}`)
      .set(bearer(adminToken))
      .send({ role: "admin" })
      .expect(200);

    expect(res.body.data.role).toBe("admin");
  });

  it("delete: owner removes account → 204, then 404; stranger 403", async () => {
    const owner = await registerUser(ctx.app);
    const stranger = await registerUser(ctx.app);

    await request(ctx.app)
      .delete(`/api/v1/users/${stranger.userId}`)
      .set(bearer(owner.token))
      .expect(403);

    await request(ctx.app)
      .delete(`/api/v1/users/${owner.userId}`)
      .set(bearer(owner.token))
      .expect(204);

    await request(ctx.app)
      .get(`/api/v1/users/${owner.userId}`)
      .set(bearer(owner.token))
      .expect(404);
  });

  it("admin filters the list with query params", async () => {
    await registerUser(ctx.app, { email: "filter-me@example.com" });
    await registerUser(ctx.app);

    const res = await request(ctx.app)
      .get("/api/v1/users?q=filter-me&sort=name")
      .set(bearer(adminToken))
      .expect(200);

    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0].email).toBe("filter-me@example.com");
  });

  it("rejects perPage above the limit → 400", async () => {
    const res = await request(ctx.app)
      .get("/api/v1/users?perPage=1000")
      .set(bearer(adminToken))
      .expect(400);

    expect(res.body.invalidParams).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "perPage" })]),
    );
  });
});
