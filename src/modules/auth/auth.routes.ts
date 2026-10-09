import { Router } from "express";

import { requireAuth } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { createAuthController } from "./auth.controller.js";
import { loginSchema, registerSchema } from "./auth.schemas.js";
import type { AuthService } from "./auth.service.js";

export function authRoutes(service: AuthService): Router {
  const router = Router();
  const controller = createAuthController(service);

  router.post(
    "/register",
    validate({ body: registerSchema }),
    controller.register,
  );
  router.post("/login", validate({ body: loginSchema }), controller.login);
  router.get("/me", requireAuth, controller.me);

  return router;
}
