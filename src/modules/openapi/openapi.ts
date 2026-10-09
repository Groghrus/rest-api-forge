import { createDocument } from "zod-openapi";
import { z } from "zod";

import {
  loginSchema,
  registerSchema,
  authResultSchema,
} from "../auth/auth.schemas.js";
import {
  createUserSchema,
  idParamsSchema,
  listUsersQuerySchema,
  patchUserSchema,
  userSchema,
} from "../users/users.schema.js";

const pageMetaSchema = z
  .object({
    page: z.number().int().describe("Текущая страница (с 1)"),
    perPage: z.number().int().describe("Размер страницы"),
    total: z.number().int().describe("Всего записей"),
    totalPages: z.number().int().describe("Всего страниц"),
  })
  .meta({ id: "PageMeta" });

const problemSchema = z
  .object({
    type: z.string().describe("URI типа проблемы"),
    title: z.string().describe("Короткое описание статуса"),
    status: z.number().int().describe("HTTP-статус"),
    detail: z.string().optional().describe("Человекочитаемая деталь"),
    instance: z.string().optional().describe("URI запроса"),
    invalidParams: z
      .array(z.object({ path: z.string(), message: z.string() }))
      .optional()
      .describe("Ошибки валидации полей"),
  })
  .meta({
    id: "Problem",
    description: "Формат ошибки RFC 9457 (application/problem+json)",
  });

const healthSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  uptime: z.number().describe("Секунды с момента старта процесса"),
  timestamp: z.string().meta({ format: "date-time" }),
  database: z.enum(["up", "down", "unchecked"]),
});

const json = (schema: z.ZodType) => ({
  "application/json": { schema },
});

const problem = (schema: z.ZodType) => ({
  "application/problem+json": { schema },
});

const problemResponse = (description: string) => ({
  description,
  content: problem(problemSchema),
});

const bearer = [{ bearerAuth: [] as string[] }];

/** OpenAPI 3.1-документ, собранный из тех же Zod-схем, что валидируют запросы */
export const openapiDocument = createDocument({
  openapi: "3.1.0",
  info: {
    title: "rest-api-forge API",
    version: "0.1.0",
    description: [
      "Учебно-шаблонный REST API.",
      "",
      "- Успех: `{ data }` или `{ data, meta }`.",
      "- Ошибки: RFC 9457, `Content-Type: application/problem+json`.",
      "- Авторизация: `Authorization: Bearer <JWT>`.",
    ].join("\n"),
  },
  servers: [{ url: "http://localhost:3000/api/v1" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Проверка здоровья сервиса",
        responses: {
          "200": {
            description: "Сервис работает",
            content: json(z.object({ data: healthSchema })),
          },
          "503": {
            description: "База данных недоступна",
            content: json(z.object({ data: healthSchema })),
          },
        },
      },
    },
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Регистрация нового пользователя",
        requestBody: {
          required: true,
          content: json(registerSchema),
        },
        responses: {
          "201": {
            description: "Пользователь создан, возвращён токен",
            content: json(z.object({ data: authResultSchema })),
          },
          "400": problemResponse("Ошибка валидации"),
          "409": problemResponse("Email уже занят"),
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Вход по email и паролю",
        requestBody: {
          required: true,
          content: json(loginSchema),
        },
        responses: {
          "200": {
            description: "Успешный вход",
            content: json(z.object({ data: authResultSchema })),
          },
          "400": problemResponse("Ошибка валидации"),
          "401": problemResponse("Неверный email или пароль"),
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Текущий пользователь по токену",
        security: bearer,
        responses: {
          "200": {
            description: "Профиль",
            content: json(z.object({ data: userSchema })),
          },
          "401": problemResponse("Нет токена или токен невалиден"),
        },
      },
    },
    "/users": {
      get: {
        tags: ["Users"],
        summary: "Список пользователей (admin)",
        security: bearer,
        requestParams: { query: listUsersQuerySchema },
        responses: {
          "200": {
            description: "Страница списка пользователей",
            content: json(
              z.object({
                data: z.array(userSchema),
                meta: pageMetaSchema,
              }),
            ),
          },
          "401": problemResponse("Нет токена"),
          "403": problemResponse("Роль не admin"),
        },
      },
      post: {
        tags: ["Users"],
        summary: "Создать пользователя (admin)",
        security: bearer,
        requestBody: {
          required: true,
          content: json(createUserSchema),
        },
        responses: {
          "201": {
            description: "Создан, в заголовке Location — URI",
            content: json(z.object({ data: userSchema })),
          },
          "400": problemResponse("Ошибка валидации"),
          "401": problemResponse("Нет токена"),
          "403": problemResponse("Роль не admin"),
          "409": problemResponse("Email уже занят"),
        },
      },
    },
    "/users/{id}": {
      get: {
        tags: ["Users"],
        summary: "Получить пользователя (владелец или admin)",
        security: bearer,
        requestParams: { path: idParamsSchema },
        responses: {
          "200": {
            description: "Пользователь",
            content: json(z.object({ data: userSchema })),
          },
          "400": problemResponse("Невалидный id"),
          "401": problemResponse("Нет токена"),
          "403": problemResponse("Не владелец и не admin"),
          "404": problemResponse("Не найден"),
        },
      },
      patch: {
        tags: ["Users"],
        summary: "Обновить пользователя (владелец или admin)",
        security: bearer,
        requestParams: { path: idParamsSchema },
        requestBody: {
          required: true,
          content: json(patchUserSchema),
        },
        responses: {
          "200": {
            description: "Обновлён",
            content: json(z.object({ data: userSchema })),
          },
          "400": problemResponse("Ошибка валидации"),
          "401": problemResponse("Нет токена"),
          "403": problemResponse("Не владелец / смена роли без admin"),
          "404": problemResponse("Не найден"),
          "409": problemResponse("Email уже занят"),
        },
      },
      delete: {
        tags: ["Users"],
        summary: "Удалить пользователя (владелец или admin)",
        security: bearer,
        requestParams: { path: idParamsSchema },
        responses: {
          "204": { description: "Удалён" },
          "400": problemResponse("Невалидный id"),
          "401": problemResponse("Нет токена"),
          "403": problemResponse("Не владелец и не admin"),
          "404": problemResponse("Не найден"),
        },
      },
    },
  },
});
