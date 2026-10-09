import { z } from "zod";

import { userSchema } from "../users/users.schema.js";

export const registerSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(2).max(100),
  password: z.string().min(8).max(72),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(72),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const authResultSchema = z
  .object({
    token: z.string().describe("JWT access token"),
    user: userSchema,
  })
  .meta({ id: "AuthResult", description: "Токен и текущий пользователь" });

export type AuthResult = z.infer<typeof authResultSchema>;
