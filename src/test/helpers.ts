import type { Express } from "express";
import request from "supertest";

import { createApp, type AppOptions } from "../app.js";
import { hashPassword } from "../common/password.js";
import { InMemoryUsersRepository } from "../modules/users/users.repository.memory.js";

export const ADMIN_EMAIL = "admin@example.com";
export const ADMIN_PASSWORD = "admin-password1";

export interface TestContext {
  app: Express;
  usersRepository: InMemoryUsersRepository;
}

/** Приложение поверх in-memory хранилища — БД не требуется */
export function createTestApp(options?: AppOptions): TestContext {
  const usersRepository = new InMemoryUsersRepository();
  const app = createApp({ usersRepository }, options);
  return { app, usersRepository };
}

export async function seedAdmin(ctx: TestContext): Promise<void> {
  await ctx.usersRepository.create({
    email: ADMIN_EMAIL,
    name: "Admin",
    passwordHash: await hashPassword(ADMIN_PASSWORD),
    role: "admin",
  });
}

export async function loginAs(
  app: Express,
  email: string,
  password: string,
): Promise<string> {
  const res = await request(app)
    .post("/api/v1/auth/login")
    .send({ email, password })
    .expect(200);
  return res.body.data.token as string;
}

export async function registerUser(
  app: Express,
  overrides: Partial<{
    email: string;
    name: string;
    password: string;
  }> = {},
): Promise<{ token: string; userId: string }> {
  const input = {
    email: `user-${Math.random().toString(36).slice(2)}@example.com`,
    name: "Test User",
    password: "password123",
    ...overrides,
  };
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send(input)
    .expect(201);

  return {
    token: res.body.data.token as string,
    userId: res.body.data.user.id as string,
  };
}

export function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}
