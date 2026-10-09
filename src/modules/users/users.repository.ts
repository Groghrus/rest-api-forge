export type UserRole = "user" | "admin";

export type UserSort = "createdAt" | "-createdAt" | "name" | "-name";

/** Публичное представление пользователя — без passwordHash */
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

/** Внутреннее представление (только для repository/service) */
export interface UserWithHash extends User {
  passwordHash: string;
}

export interface CreateUserRecord {
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
}

export interface UpdateUserRecord {
  email?: string;
  name?: string;
  role?: UserRole;
  passwordHash?: string;
}

export interface ListUsersParams {
  page: number;
  perPage: number;
  sort: UserSort;
  role?: UserRole;
  q?: string;
}

export interface PaginatedUsers {
  items: User[];
  total: number;
}

/**
 * Контракт хранилища пользователей.
 * Service зависит только от интерфейса — реализации подменяются
 * (Drizzle в проде, in-memory в тестах).
 */
export interface UsersRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByEmailWithHash(email: string): Promise<UserWithHash | null>;
  list(params: ListUsersParams): Promise<PaginatedUsers>;
  create(input: CreateUserRecord): Promise<User>;
  update(id: string, input: UpdateUserRecord): Promise<User | null>;
  remove(id: string): Promise<boolean>;
}

/** Убирает секретное поле из записи перед выдачей наружу */
export function toPublicUser(record: User | UserWithHash): User {
  return {
    id: record.id,
    email: record.email,
    name: record.name,
    role: record.role,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
