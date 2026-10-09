import { Router } from "express";

import { requireAuth, requireRole } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { createUsersController } from "./users.controller.js";
import {
  createUserSchema,
  idParamsSchema,
  listUsersQuerySchema,
  patchUserSchema,
} from "./users.schema.js";
import type { UsersService } from "./users.service.js";

export function usersRoutes(service: UsersService): Router {
  const router = Router();
  const controller = createUsersController(service);

  router.get(
    "/",
    requireAuth,
    requireRole("admin"),
    validate({ query: listUsersQuerySchema }),
    controller.list,
  );

  router.post(
    "/",
    requireAuth,
    requireRole("admin"),
    validate({ body: createUserSchema }),
    controller.create,
  );

  router.get(
    "/:id",
    requireAuth,
    validate({ params: idParamsSchema }),
    controller.get,
  );

  router.patch(
    "/:id",
    requireAuth,
    validate({ params: idParamsSchema, body: patchUserSchema }),
    controller.patch,
  );

  router.delete(
    "/:id",
    requireAuth,
    validate({ params: idParamsSchema }),
    controller.remove,
  );

  return router;
}
