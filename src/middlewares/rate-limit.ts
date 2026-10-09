import rateLimit, { type Options } from "express-rate-limit";
import type { RequestHandler } from "express";

import { TooManyRequestsError } from "../common/errors.js";

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  /** false — лимитер пропускает все запросы (используется в тестах) */
  enabled?: boolean;
}

/**
 * Фабрика rate-limit middleware.
 * При превышении лимита передаёт 429 в общий error-handler —
 * ответ остаётся в едином формате RFC 9457.
 */
export function createRateLimiter({
  windowMs,
  max,
  enabled = true,
}: RateLimitConfig): RequestHandler {
  const options: Partial<Options> = {
    windowMs,
    limit: max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: () => !enabled,
    handler: (_req, _res, next) => {
      next(new TooManyRequestsError());
    },
  };

  return rateLimit(options);
}
