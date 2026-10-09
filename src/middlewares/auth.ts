import type { RequestHandler } from "express";

import { ForbiddenError, UnauthorizedError } from "../common/errors.js";
import type { AuthUser } from "../modules/auth/auth.types.js";
import { verifyToken } from "../modules/auth/token.js";
import type { UserRole } from "../modules/users/users.repository.js";

function extractBearerToken(header: string | undefined): string {
  if (!header || !header.startsWith("Bearer ")) {
    throw new UnauthorizedError(
      "Missing Bearer token: use 'Authorization: Bearer <token>'",
    );
  }
  return header.slice("Bearer ".length).trim();
}

/** Проверяет заголовок Authorization, валидирует JWT и кладёт req.user */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const payload = verifyToken(extractBearerToken(req.headers.authorization));
  req.user = { id: payload.sub, role: payload.role };
  next();
};

/** Ограничивает доступ по роли: 401 без токена, 403 при несовпадении роли */
export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      throw new UnauthorizedError();
    }
    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError("This role cannot access this resource");
    }
    next();
  };
}

/** Владелец ресурса или админ; иначе — 403 */
export function ensureOwnerOrAdmin(
  user: AuthUser | undefined,
  ownerId: string,
): void {
  if (!user) {
    throw new UnauthorizedError();
  }
  if (user.role !== "admin" && user.id !== ownerId) {
    throw new ForbiddenError("You can only access your own resources");
  }
}
