import jwt from "jsonwebtoken";

import { UnauthorizedError } from "../../common/errors.js";
import { env } from "../../config/env.js";
import type { UserRole } from "../users/users.repository.js";

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
}

export function signToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): AccessTokenPayload {
  let decoded: string | jwt.JwtPayload;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }

  if (typeof decoded === "string") {
    throw new UnauthorizedError("Invalid token payload");
  }

  const { sub, role } = decoded;
  if (typeof sub !== "string" || (role !== "user" && role !== "admin")) {
    throw new UnauthorizedError("Invalid token payload");
  }

  return { sub, role };
}
