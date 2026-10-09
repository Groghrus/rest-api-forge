import type { AuthUser } from "../modules/auth/auth.types.js";

declare module "express-serve-static-core" {
  interface Request {
    /** Заполняется middleware requireAuth после проверки JWT */
    user?: AuthUser;
    /** Результат работы middleware validate() */
    validated?: {
      body?: unknown;
      query?: unknown;
      params?: unknown;
    };
  }
}

export {};
