import type { RequestHandler } from "express";

import { UnauthorizedError } from "../../common/errors.js";
import { validatedBody } from "../../common/http.js";
import { toUserDto } from "../users/users.schema.js";
import type { LoginInput, RegisterInput } from "./auth.schemas.js";
import type { AuthService } from "./auth.service.js";

export function createAuthController(service: AuthService) {
  const register: RequestHandler = async (req, res) => {
    const input = validatedBody<RegisterInput>(req);
    const result = await service.register(input);

    res
      .status(201)
      .json({ data: { token: result.token, user: toUserDto(result.user) } });
  };

  const login: RequestHandler = async (req, res) => {
    const input = validatedBody<LoginInput>(req);
    const result = await service.login(input);

    res.json({ data: { token: result.token, user: toUserDto(result.user) } });
  };

  const me: RequestHandler = async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError();
    }
    const user = await service.me(req.user.id);

    res.json({ data: toUserDto(user) });
  };

  return { register, login, me };
}
