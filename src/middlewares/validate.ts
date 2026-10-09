import type { Request, RequestHandler } from "express";
import type { ZodType } from "zod";

export interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * Валидация на границе: всё, что пришло от клиента, проходит Zod-схему.
 * Ошибка валидации (ZodError) уходит в error-handler → 400 + invalidParams.
 */
export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req, _res, next) => {
    try {
      const validated: NonNullable<Request["validated"]> = {};

      if (schemas.body) {
        const parsed = schemas.body.parse(req.body ?? {});
        validated.body = parsed;
        req.body = parsed;
      }
      if (schemas.query) {
        validated.query = schemas.query.parse(req.query);
      }
      if (schemas.params) {
        validated.params = schemas.params.parse(req.params);
      }

      req.validated = validated;
      next();
    } catch (error) {
      next(error);
    }
  };
}
