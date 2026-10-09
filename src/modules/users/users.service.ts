import { hashPassword } from "../../common/password.js";
import { ConflictError, NotFoundError } from "../../common/errors.js";
import type { CreateUserBody, PatchUserBody } from "./users.schema.js";
import type {
  ListUsersParams,
  PaginatedUsers,
  UpdateUserRecord,
  User,
  UsersRepository,
} from "./users.repository.js";

/**
 * Бизнес-правила пользователей:
 * - email уникален (409 при конфликте);
 * - пароль хешируется до попадания в хранилище;
 * - наружу уходит только публичный DTO (без passwordHash).
 */
export class UsersService {
  constructor(private readonly users: UsersRepository) {}

  list(params: ListUsersParams): Promise<PaginatedUsers> {
    return this.users.list(params);
  }

  async getById(id: string): Promise<User> {
    const user = await this.users.findById(id);
    if (!user) {
      throw new NotFoundError(`User ${id} not found`);
    }
    return user;
  }

  async create(input: CreateUserBody): Promise<User> {
    await this.ensureEmailFree(input.email);
    const passwordHash = await hashPassword(input.password);
    return this.users.create({
      email: input.email,
      name: input.name,
      passwordHash,
      role: input.role,
    });
  }

  async update(id: string, input: PatchUserBody): Promise<User> {
    const existing = await this.getById(id);

    if (input.email && input.email !== existing.email) {
      await this.ensureEmailFree(input.email);
    }

    const patch: UpdateUserRecord = {};
    if (input.email) patch.email = input.email;
    if (input.name) patch.name = input.name;
    if (input.role) patch.role = input.role;
    if (input.password) patch.passwordHash = await hashPassword(input.password);

    const updated = await this.users.update(id, patch);
    if (!updated) {
      throw new NotFoundError(`User ${id} not found`);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const removed = await this.users.remove(id);
    if (!removed) {
      throw new NotFoundError(`User ${id} not found`);
    }
  }

  private async ensureEmailFree(email: string): Promise<void> {
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new ConflictError("User with this email already exists");
    }
  }
}
