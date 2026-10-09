import type { RequestHandler } from "express";

import { buildMeta } from "../../common/pagination.js";
import {
  validatedBody,
  validatedParams,
  validatedQuery,
} from "../../common/http.js";
import { ForbiddenError } from "../../common/errors.js";
import { ensureOwnerOrAdmin } from "../../middlewares/auth.js";
import type {
  CreateUserBody,
  IdParams,
  ListUsersQuery,
  PatchUserBody,
} from "./users.schema.js";
import { toUserDto } from "./users.schema.js";
import type { UsersService } from "./users.service.js";

/**
 * Controller — только HTTP: достал проверенные данные из запроса,
 * вызовал service, отправил ответ. Бизнес-логики и SQL здесь нет.
 * Async-исключения Express 5 сам передаёт в error-handler.
 */
export function createUsersController(service: UsersService) {
  const list: RequestHandler = async (req, res) => {
    const query = validatedQuery<ListUsersQuery>(req);
    const { items, total } = await service.list(query);

    res.json({
      data: items.map(toUserDto),
      meta: buildMeta({
        page: query.page,
        perPage: query.perPage,
        total,
      }),
    });
  };

  const get: RequestHandler = async (req, res) => {
    const { id } = validatedParams<IdParams>(req);
    const user = await service.getById(id);
    ensureOwnerOrAdmin(req.user, user.id);

    res.json({ data: toUserDto(user) });
  };

  const create: RequestHandler = async (req, res) => {
    const input = validatedBody<CreateUserBody>(req);
    const user = await service.create(input);

    res
      .header("Location", `/api/v1/users/${user.id}`)
      .status(201)
      .json({ data: toUserDto(user) });
  };

  const patch: RequestHandler = async (req, res) => {
    const { id } = validatedParams<IdParams>(req);
    const user = await service.getById(id);
    ensureOwnerOrAdmin(req.user, user.id);

    const input = validatedBody<PatchUserBody>(req);
    if (input.role !== undefined && req.user?.role !== "admin") {
      throw new ForbiddenError("Only admins can change roles");
    }

    const updated = await service.update(id, input);
    res.json({ data: toUserDto(updated) });
  };

  const remove: RequestHandler = async (req, res) => {
    const { id } = validatedParams<IdParams>(req);
    const user = await service.getById(id);
    ensureOwnerOrAdmin(req.user, user.id);

    await service.remove(id);
    res.status(204).send();
  };

  return { list, get, create, patch, remove };
}
