import type { UserRole } from "../users/users.repository.js";

/** Идентичность из JWT — заполняется requireAuth в req.user */
export interface AuthUser {
  id: string;
  role: UserRole;
}
