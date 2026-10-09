import express, { type Express } from "express";

import { env } from "./config/env.js";
import { createCorsMiddleware, parseOrigins } from "./middlewares/cors.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { notFoundHandler } from "./middlewares/not-found.js";
import { createRateLimiter } from "./middlewares/rate-limit.js";
import { requestLogger } from "./middlewares/request-logger.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { openapiRoutes } from "./modules/openapi/openapi.routes.js";
import type { UsersRepository } from "./modules/users/users.repository.js";
import { usersRoutes } from "./modules/users/users.routes.js";
import { UsersService } from "./modules/users/users.service.js";

export interface AppDeps {
  usersRepository: UsersRepository;
  /** Проверка соединения с БД для /health (опционально — в тестах не нужна) */
  checkDatabase?: () => Promise<boolean>;
}

export interface AppOptions {
  /** Whitelist CORS; `[]` — CORS выключен. По умолчанию — из env `CORS_ORIGINS`. */
  corsOrigins?: string[];
  /**
   * Лимит частоты на `/auth/*`. `false` — выключен.
   * По умолчанию — из env; в тестовом окружении выключен.
   */
  authRateLimit?: { windowMs: number; max: number } | false;
}

function defaultAuthRateLimit(): { windowMs: number; max: number } | false {
  if (env.NODE_ENV === "test") {
    return false;
  }
  return {
    windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
    max: env.AUTH_RATE_LIMIT_MAX,
  };
}

/**
 * Фабрика приложения: всё состояние приходит снаружи.
 * Тесты подставляют in-memory repository, server — Drizzle.
 */
export function createApp(deps: AppDeps, options: AppOptions = {}): Express {
  const app = express();

  const corsOrigins = options.corsOrigins ?? parseOrigins(env.CORS_ORIGINS);
  const authRateLimit =
    options.authRateLimit === undefined
      ? defaultAuthRateLimit()
      : options.authRateLimit;

  app.disable("x-powered-by");
  app.use(requestLogger);
  app.use(createCorsMiddleware(corsOrigins));
  app.use(express.json({ limit: "100kb" }));

  app.use("/api/v1/health", healthRoutes(deps.checkDatabase));

  const authRouter = authRoutes(new AuthService(deps.usersRepository));
  if (authRateLimit) {
    app.use("/api/v1/auth", createRateLimiter(authRateLimit), authRouter);
  } else {
    app.use("/api/v1/auth", authRouter);
  }

  app.use("/api/v1/users", usersRoutes(new UsersService(deps.usersRepository)));
  app.use("/api/v1", openapiRoutes());

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
