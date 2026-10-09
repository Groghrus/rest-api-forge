import { z } from "zod";

import { paginationQuerySchema } from "../../common/pagination.js";
import type { User } from "./users.repository.js";

export const userRoleSchema = z.enum(["user", "admin"]);

export const userSchema = z
  .object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string().min(2).max(100),
    role: userRoleSchema,
    createdAt: z.string().meta({ format: "date-time" }),
    updatedAt: z.string().meta({ format: "date-time" }),
  })
  .meta({ id: "User", description: "Пользователь системы" });

export type UserDto = z.infer<typeof userSchema>;

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export const createUserSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(2).max(100),
  password: z.string().min(8).max(72),
  role: userRoleSchema.default("user"),
});
export type CreateUserBody = z.infer<typeof createUserSchema>;

export const patchUserSchema = z
  .object({
    email: z.string().email().max(255).optional(),
    name: z.string().min(2).max(100).optional(),
    role: userRoleSchema.optional(),
    password: z.string().min(8).max(72).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Body must contain at least one field",
  });
export type PatchUserBody = z.infer<typeof patchUserSchema>;

export const listUsersQuerySchema = paginationQuerySchema.extend({
  role: userRoleSchema.optional(),
  q: z.string().trim().max(100).optional(),
  sort: z
    .enum(["createdAt", "-createdAt", "name", "-name"])
    .default("-createdAt"),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const idParamsSchema = z.object({
  id: z.string().uuid(),
});
export type IdParams = z.infer<typeof idParamsSchema>;
