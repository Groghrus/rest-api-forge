import { randomUUID } from "node:crypto";

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

/**
 * Хранилище в памяти — для тестов и демонстрации архитектуры:
 * тот же интерфейс, что и у Drizzle-реализации.
 */
export class InMemoryUsersRepository implements UsersRepository {
  private readonly store = new Map<string, UserWithHash>();

  async findById(id: string): Promise<User | null> {
    const record = this.store.get(id);
    return record ? toPublicUser(record) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const record = await this.findByEmailWithHash(email);
    return record ? toPublicUser(record) : null;
  }

  async findByEmailWithHash(email: string): Promise<UserWithHash | null> {
    const needle = email.toLowerCase();
    for (const record of this.store.values()) {
      if (record.email.toLowerCase() === needle) {
        return { ...record };
      }
    }
    return null;
  }

  async list(params: ListUsersParams): Promise<PaginatedUsers> {
    let items = [...this.store.values()];

    if (params.role) {
      items = items.filter((user) => user.role === params.role);
    }
    if (params.q) {
      const needle = params.q.toLowerCase();
      items = items.filter(
        (user) =>
          user.email.toLowerCase().includes(needle) ||
          user.name.toLowerCase().includes(needle),
      );
    }

    const total = items.length;
    items.sort(compareBy(params.sort));

    const from = (params.page - 1) * params.perPage;
    items = items.slice(from, from + params.perPage);

    return { items: items.map(toPublicUser), total };
  }

  async create(input: CreateUserRecord): Promise<User> {
    const now = new Date();
    const record: UserWithHash = {
      id: randomUUID(),
      ...input,
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(record.id, record);
    return toPublicUser(record);
  }

  async update(id: string, input: UpdateUserRecord): Promise<User | null> {
    const record = this.store.get(id);
    if (!record) return null;

    const updated: UserWithHash = {
      ...record,
      ...input,
      updatedAt: new Date(),
    };
    this.store.set(id, updated);
    return toPublicUser(updated);
  }

  async remove(id: string): Promise<boolean> {
    return this.store.delete(id);
  }
}

function compareBy(
  sort: ListUsersParams["sort"],
): (a: UserWithHash, b: UserWithHash) => number {
  const descending = sort.startsWith("-");
  const field = descending ? sort.slice(1) : sort;

  return (a, b) => {
    let result: number;
    if (field === "name") {
      result = a.name.localeCompare(b.name);
    } else {
      result = a.createdAt.getTime() - b.createdAt.getTime();
    }
    return descending ? -result : result;
  };
}
