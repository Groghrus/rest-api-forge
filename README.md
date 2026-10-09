# rest-api-forge

Шаблон REST API на **Node.js + TypeScript**: как спроектировать архитектуру REST API — слои, валидация, единый формат ошибок, JWT-auth.

Клонируй под новый проект: структура `modules/<feature>/{routes,controller,service,repository,schemas}` переиспользуется как есть.

**Стек:** Express 5 · TypeScript (strict) · PostgreSQL · Drizzle ORM · Zod · JWT + bcrypt · pino · CORS · rate limiting · Vitest + supertest

## Быстрый старт

```bash
# 1. Зависимости
npm install

# 2. Переменные окружения
cp .env.example .env

# 3. База данных (нужен запущенный PostgreSQL)
npm run db:migrate    # создать таблицы
npm run db:seed       # создать админа из ADMIN_EMAIL/ADMIN_PASSWORD

# 4. Dev-сервер
npm run dev
```

- API: <http://localhost:3000/api/v1>
- Swagger UI: <http://localhost:3000/api/v1/docs>
- OpenAPI JSON: <http://localhost:3000/api/v1/openapi.json>

## Скрипты

| Команда                       | Назначение                                  |
| ----------------------------- | ------------------------------------------- |
| `npm run dev`                 | Dev-сервер с hot-reload (tsx)               |
| `npm run build` / `npm start` | Сборка (tsc) и запуск из `dist/`            |
| `npm run lint`                | ESLint (flat config + typescript-eslint)    |
| `npm run typecheck`           | `tsc --noEmit`                              |
| `npm run format`              | Prettier                                    |
| `npm test`                    | Vitest (40 тестов, БД не нужна)             |
| `npm run db:generate`         | Сгенерировать SQL-миграцию из схемы Drizzle |
| `npm run db:migrate`          | Применить миграции                          |
| `npm run db:seed`             | Посеять администратора                      |

## API

| Метод  | Путь             | Доступ      | Описание                                |
| ------ | ---------------- | ----------- | --------------------------------------- |
| GET    | `/health`        | —           | Здоровье сервиса (+ статус БД)          |
| POST   | `/auth/register` | —           | Регистрация → JWT                       |
| POST   | `/auth/login`    | —           | Вход → JWT                              |
| GET    | `/auth/me`       | auth        | Текущий пользователь                    |
| GET    | `/users`         | admin       | Список (фильтры, пагинация, сортировка) |
| POST   | `/users`         | admin       | Создать пользователя                    |
| GET    | `/users/:id`     | owner/admin | Получить                                |
| PATCH  | `/users/:id`     | owner/admin | Обновить (роль — только admin)          |
| DELETE | `/users/:id`     | owner/admin | Удалить                                 |
| GET    | `/openapi.json`  | —           | OpenAPI 3.1 (генерируется из Zod-схем)  |
| GET    | `/docs`          | —           | Swagger UI                              |

### Форматы

Успех:

```json
{ "data": { "id": "..." } }
```

Список:

```json
{
  "data": [],
  "meta": { "page": 1, "perPage": 20, "total": 137, "totalPages": 7 }
}
```

Ошибка — RFC 9457, `application/problem+json`:

```json
{
  "type": "https://rest-api-forge.dev/problems/validation-error",
  "title": "Bad Request",
  "status": 400,
  "detail": "Request validation failed",
  "instance": "/api/v1/users",
  "invalidParams": [{ "path": "email", "message": "Invalid email" }]
}
```

## Структура

```
src/
  server.ts            # entry: config → db → app → listen (graceful shutdown)
  app.ts               # createApp(deeps) — фабрика, тесты работают без БД
  config/env.ts        # env-схема (Zod): конфигурация только здесь
  common/              # ошибки (AppError), logger, пагинация, хелперы
  middlewares/         # cors, request-logger, validate, auth, rate-limit, error-handler, not-found
  modules/
    health/            # GET /health
    auth/              # register/login/me, JWT, bcrypt
    users/             # CRUD: routes → controller → service → repository
    openapi/           # OpenAPI 3.1 из Zod-схем + Swagger UI
  db/                  # Drizzle: схема, клиент, миграции, seed
  test/helpers.ts      # createApp с in-memory repository
```

Поток запроса: `cors → logger → express.json → requireAuth → validate(Zod) → routes → controller → service → repository → error-handler (RFC 9457)`.

Ключевое: **service зависит от интерфейса `UsersRepository`** — в проде Drizzle/PostgreSQL, в тестах in-memory; бизнес-логика не знает ничего про Express и SQL.

## Политики доступа

- **CORS**: whitelist из `CORS_ORIGINS` (через запятую). Пусто — CORS выключен; `*` — любой источник (только dev). Preflight (`OPTIONS`) обрабатывается автоматически.
- **Rate limiting**: на `/auth/*` (login/register/me) — по умолчанию 10 запросов на IP за 15 минут (`AUTH_RATE_LIMIT_MAX` / `AUTH_RATE_LIMIT_WINDOW_MS`). При превышении — `429` в формате RFC 9457 + заголовки `RateLimit-*`.

## Документация

Основы проектирования REST API, план разработки и контекст проекта — в локальной папке `../doc` (в репозиторий не входит):

- [REST-API-BASICS.md](../doc/REST-API-BASICS.md) — теория + практика: ресурсы, методы, статусы, ошибки, архитектура, чек-лист
- [TASKS.md](../doc/TASKS.md) — план разработки
- [CONTEXT.md](../doc/CONTEXT.md) — контекст и решения

## Лицензия

MIT
