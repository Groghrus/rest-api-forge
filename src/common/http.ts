import type { Request } from "express";

/**
 * После middleware `validate(...)` эти хелперы возвращают
 * уже проверенные и приведённые к типу данные.
 * Каст здесь безопасен: доверяем только тому, что прошло Zod.
 */
export function validatedBody<T>(req: Request): T {
  return req.validated?.body as T;
}

export function validatedQuery<T>(req: Request): T {
  return req.validated?.query as T;
}

export function validatedParams<T>(req: Request): T {
  return req.validated?.params as T;
}
