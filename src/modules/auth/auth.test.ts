import request from "supertest";
import { describe, expect, it } from "vitest";

import { bearer, createTestApp, registerUser } from "../../test/helpers.js";

describe("auth", () => {
  it("register → 201 with token and user without password", async () => {
    const { app } = createTestApp();

    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email: "new@example.com",
        name: "New User",
        password: "password123",
      })
      .expect(201);

    expect(typeof res.body.data.token).toBe("string");
    expect(res.body.data.user).toMatchObject({
      email: "new@example.com",
      role: "user",
    });
    expect(JSON.stringify(res.body)).not.toContain("password");
  });

  it("register duplicate email → 409", async () => {
    const { app } = createTestApp();

    await request(app)
      .post("/api/v1/auth/register")
      .send({
        email: "dup@example.com",
        name: "First",
        password: "password123",
      })
      .expect(201);

    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email: "dup@example.com",
        name: "Second",
        password: "password123",
      })
      .expect(409);

    expect(res.body.type).toContain("/problems/conflict");
  });

  it("register with invalid payload → 400 with field errors", async () => {
    const { app } = createTestApp();

    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "not-an-email", name: "X", password: "123" })
      .expect(400);

    const paths = res.body.invalidParams.map(
      (param: { path: string }) => param.path,
    );
    expect(paths).toContain("email");
    expect(paths).toContain("name");
    expect(paths).toContain("password");
  });

  it("login with correct password → 200", async () => {
    const { app } = createTestApp();
    await registerUser(app, { email: "login@example.com" });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "login@example.com", password: "password123" })
      .expect(200);

    expect(typeof res.body.data.token).toBe("string");
    expect(res.body.data.user.email).toBe("login@example.com");
  });

  it("login with wrong password → 401 with generic message", async () => {
    const { app } = createTestApp();
    await registerUser(app, { email: "login@example.com" });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "login@example.com", password: "wrong-password" })
      .expect(401);

    expect(res.headers["content-type"]).toContain("application/problem+json");
    expect(res.body.detail).toBe("Invalid email or password");
  });

  it("login with unknown email → 401 with the same message", async () => {
    const { app } = createTestApp();

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "ghost@example.com", password: "password123" })
      .expect(401);

    expect(res.body.detail).toBe("Invalid email or password");
  });

  it("GET /auth/me returns current user for a valid token", async () => {
    const { app } = createTestApp();
    const { token, userId } = await registerUser(app);

    const res = await request(app)
      .get("/api/v1/auth/me")
      .set(bearer(token))
      .expect(200);

    expect(res.body.data.id).toBe(userId);
    expect(JSON.stringify(res.body)).not.toContain("password");
  });

  it("GET /auth/me → 401 without token and with a garbage token", async () => {
    const { app } = createTestApp();

    await request(app).get("/api/v1/auth/me").expect(401);

    await request(app)
      .get("/api/v1/auth/me")
      .set(bearer("garbage.token.value"))
      .expect(401);
  });

  it("missing Authorization header format → 401", async () => {
    const { app } = createTestApp();

    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Basic abc")
      .expect(401);

    expect(res.body.detail).toContain("Bearer");
  });
});
