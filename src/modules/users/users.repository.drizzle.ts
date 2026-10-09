import { and, asc, count, desc, eq, ilike, or } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { users, type UserRow } from "../../db/schema.js";
import {
  toPublicUser,
  type CreateUserRecord,
  type ListUsersParams,
  type PaginatedUsers,
  type UpdateUserRecord,
  type User,
  type UsersRepository,
  type UserWithHash,
} from "./users.repository.js";

function toDomain(row: UserRow): User {
  return toPublicUser(row);
}

/**
 * PostgreSQL-реализация хранилища на Drizzle ORM.
 * Единственное место в приложении, где живёт SQL.
 */
export class DrizzleUsersRepository implements UsersRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    const row = rows[0];
    return row ? toDomain(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const record = await this.findByEmailWithHash(email);
    return record ? toPublicUser(record) : null;
  }

  async findByEmailWithHash(email: string): Promise<UserWithHash | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    const row = rows[0];
    return row ? { ...toDomain(row), passwordHash: row.passwordHash } : null;
  }

  async list(params: ListUsersParams): Promise<PaginatedUsers> {
    const conditions = [];
    if (params.role) {
      conditions.push(eq(users.role, params.role));
    }
    if (params.q) {
      const pattern = `%${params.q}%`;
      conditions.push(
        or(ilike(users.email, pattern), ilike(users.name, pattern)),
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const totalRows = await this.db
      .select({ total: count() })
      .from(users)
      .where(where);
    const total = totalRows[0]?.total ?? 0;

    const descending = params.sort.startsWith("-");
    const field = descending ? params.sort.slice(1) : params.sort;
    const column = field === "name" ? users.name : users.createdAt;
    const orderBy = descending ? desc(column) : asc(column);

    const rows = await this.db
      .select()
      .from(users)
      .where(where)
      .orderBy(orderBy)
      .limit(params.perPage)
      .offset((params.page - 1) * params.perPage);

    return { items: rows.map(toDomain), total };
  }

  async create(input: CreateUserRecord): Promise<User> {
    const rows = await this.db.insert(users).values(input).returning();
    const row = rows[0];
    if (!row) {
      throw new Error("insert returned no rows");
    }
    return toDomain(row);
  }

  async update(id: string, input: UpdateUserRecord): Promise<User | null> {
    if (Object.keys(input).length === 0) {
      return this.findById(id);
    }
    const rows = await this.db
      .update(users)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    const row = rows[0];
    return row ? toDomain(row) : null;
  }

  async remove(id: string): Promise<boolean> {
    const rows = await this.db
      .delete(users)
      .where(eq(users.id, id))
      .returning({ id: users.id });
    return rows.length > 0;
  }
}
