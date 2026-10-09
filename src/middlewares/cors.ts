import cors, { type CorsOptions } from "cors";
import type { RequestHandler } from "express";

/** "a, b ,,c" → ["a", "b", "c"] */
export function parseOrigins(raw: string): string[] {
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export function buildCorsOptions(origins: string[]): CorsOptions {
  return {
    // "*" — разрешить любой источник; иначе только перечисленные (cors сравнит сам).
    origin: origins.includes("*") ? "*" : origins,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    // Отдаём клиенту Location из 201 ответов (POST /users).
    exposedHeaders: ["Location"],
    maxAge: 86_400,
  };
}

/**
 * CORS-политика: whitelist из `CORS_ORIGINS` (через запятую).
 * Пустой список — CORS выключен: cross-origin запросы не получают заголовков.
 * `*` — разрешить любой источник (только для разработки).
 */
export function createCorsMiddleware(origins: string[]): RequestHandler {
  if (origins.length === 0) {
    return (_req, _res, next) => next();
  }
  return cors(buildCorsOptions(origins));
}
