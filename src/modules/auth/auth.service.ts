import { ConflictError, UnauthorizedError } from "../../common/errors.js";
import { hashPassword, verifyPassword } from "../../common/password.js";
import type { User, UsersRepository } from "../users/users.repository.js";
import type { LoginInput, RegisterInput } from "./auth.schemas.js";
import { signToken } from "./token.js";

export interface AuthenticatedResult {
  token: string;
  user: User;
}

/**
 * Аутентификация: регистрация, вход, текущий пользователь.
 * Пароль никогда не покидает сервис в открытом виде — только хеш.
 */
export class AuthService {
  constructor(private readonly users: UsersRepository) {}

  async register(input: RegisterInput): Promise<AuthenticatedResult> {
    const existing = await this.users.findByEmail(input.email);
    if (existing) {
      throw new ConflictError("User with this email already exists");
    }

    const user = await this.users.create({
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
      role: "user",
    });

    return { token: signToken({ sub: user.id, role: user.role }), user };
  }

  async login(input: LoginInput): Promise<AuthenticatedResult> {
    const record = await this.users.findByEmailWithHash(input.email);
    // Одинаковый текст ошибки для «нет пользователя» и «неверный пароль»,
    // чтобы не раскрывать, какие email зарегистрированы
    if (!record) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const valid = await verifyPassword(input.password, record.passwordHash);
    if (!valid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    return {
      token: signToken({ sub: record.id, role: record.role }),
      user: {
        id: record.id,
        email: record.email,
        name: record.name,
        role: record.role,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
    };
  }

  async me(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedError("User no longer exists");
    }
    return user;
  }
}
