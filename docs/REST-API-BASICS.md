# Основы проектирования REST API на Node.js (TypeScript)

Практическое пособие: теория → применение в проекте `rest-api-forge` → чек-лист.

---

## 1. Что такое REST

**REST** (Representational State Transfer) — архитектурный стиль, у Арменталя (Roy Fielding, 2000). Не библиотека и не протокол — набор ограничений:

| Ограничение | Суть | Как делаем в проекте |
|---|---|---|
| **Единый интерфейс** | Ресурсы идентифицируются URL, операции — стандартными HTTP-методами | `GET /api/v1/users/:id` |
| **Stateless** | Каждый запрос самодостаточен, сервер не хранит состояние сессии | JWT в `Authorization` header |
| **Кэшируемость** | Ответы помечаются `Cache-Control`, `ETag` | `ETag` на `GET /users/:id` (опц.) |
| **Слоистая система** | Клиент не знает внутреннюю структуру сервера | Слои routes→controller→service→repository |
| **Файлы-коды** (опц.) | `<a href>` — «самоописываемость» | OpenAPI-документ |

Главный принцип: **ресурсы — существительные, действия — HTTP-методы**.

```http
❌ POST /api/v1/users/create        — действие в URL
❌ GET  /api/v1/getUsers?act=delete — «RPC поверх HTTP»
✅ GET  /api/v1/users               — получить список
✅ POST /api/v1/users               — создать
```

---

## 2. Ресурсы и URL

### Правила

1. **Множественное число, lower case, через дефис**: `/api/v1/user-profiles`
2. **Вложенность — не глубже одного уровня**: `/users/:id/posts` — ок; `/users/:id/posts/:id/comments/:id` — уже боль (см. §15).
3. **Вложенный ресурс фильтрует родителя**: `GET /users/42/posts` = «посты пользователя 42», а не «пост с id=42».
4. **Коллекция и элемент — разные URL**: `/users` (список) vs `/users/:id` (один).
5. **Действия/под-состояния — не глаголы в URL**: вместо `POST /users/42/activate` — `PATCH /users/42 { "status": "active" }`. Но нестандартные операции-исключения допустимы: `POST /auth/login`, `POST /auth/refresh` — логин нельзя выразить PATCH-ем над ресурсом.

### Типовой ресурсный план

```
/api/v1/health              — служебный
/api/v1/auth/register       — регистрация
/api/v1/auth/login          — вход
/api/v1/users               — коллекция пользователей
/api/v1/users/:id           — элемент
```

---

## 3. HTTP-методы: семантика

| Метод | Назначение | Safe | Idempotent | Ответ 200/201 | Тело запроса |
|---|---|---|---|---|---|
| **GET** | чтение | ✅ | ✅ | 200 | нет |
| **POST** | создание / неидемпотентные действия | ❌ | ❌ | **201** + `Location` | есть |
| **PUT** | полная замена | ❌ | ✅ | 200 | есть |
| **PATCH** | частичное обновление | ❌ | ✅ | 200 | есть |
| **DELETE** | удаление | ❌ | ✅ | **204** No Content | нет |

- **Safe** — не изменяет состояние (GET/HEAD).
- **Idempotent** — повторный запрос даёт тот же эффект. `PUT /users/1` с тем же телом дважды = один результат. Поэтому повтор таймаута `DELETE` безопасен, а повтор `POST` может создать дубль → клиенту нужен ключ идемпотентности (§12).
- **PUT vs PATCH**: PUT — «замени целиком» (все обязательные поля есть в запросе), PATCH — «измени частично». В проекте: `PUT` для полной замены, `PATCH` для точечных правок (`PATCH /users/:id { "name": "..." }`).
- **201 Created**: в `Location` — URL созданного ресурса.
- **204 No Content**: успех, тела нет (DELETE).

```http
POST /api/v1/users HTTP/1.1
Content-Type: application/json

{ "email": "a@b.c", "name": "Alice" }

→ HTTP/1.1 201 Created
Location: /api/v1/users/0d3f...
Content-Type: application/json

{ "data": { "id": "0d3f...", "email": "a@b.c", "name": "Alice", "role": "user" } }
```

---

## 4. Статус-коды

| Код | Значение | Примеры в проекте |
|---|---|---|
| **200** | OK | `GET /users/:id`, `PATCH` |
| **201** | Created | `POST /users`, `POST /auth/register` |
| **204** | No Content | `DELETE /users/:id` |
| **400** | Bad Request — невалидный JSON/поля | Zod-ошибка валидации |
| **401** | Unauthorized — **нет/просрочен** токен | `requireAuth` без `Authorization` |
| **403** | Forbidden — токен есть, **прав нет** | `user` лезет в админ-эндпоинт |
| **404** | Not Found — ресурс не существует | `GET /users/999` |
| **409** | Conflict — конфликт состояния | email уже занят |
| **422** | Unprocessable — семантика неверна | (альтернатива 400 для бизнес-правил) |
| **429** | Too Many Requests | rate limiting |
| **500** | Internal Server Error — баг на нашей стороне | непойманная ошибка |

**401 vs 403** — самая частая путаница: 401 = «кто ты?», 403 = «ты известен, но нельзя».

**5xx** — никогда не отдавать внутренности (`stack trace`, SQL) наружу.

---

## 5. Формат ответов, пагинация, фильтры

### Единый envelope

```jsonc
// один ресурс
{ "data": { "id": "...", "name": "Alice" } }

// коллекция
{
  "data": [ ... ],
  "meta": { "page": 1, "perPage": 20, "total": 137, "totalPages": 7 }
}
```

`data` — стабильное место для полезной нагрузки → клиент пишет `res.data.data`, ошибки всегда в другом формате (§6).

### Пагинация

Offset-based (проще, достаточно для MVP):

```http
GET /api/v1/users?page=2&perPage=20&sort=-createdAt&role=admin
```

- `page` — с 1, `perPage` — с ограничением (≤100), иначе DoS «возьми всё».
- `sort` — префикс `-` = DESC (`-createdAt`, `name`).
- На большой БД — keyset-пагинация (`?cursor=...`), это post-MVP.

### Фильтры — плоские query-параметры

```http
GET /users?role=admin&verified=true&q=alice
```

Не «операторы в строке» (`role=in:(admin,user)`) — сложность без нужды.

---

## 6. Ошибки: RFC 9457 (Problem Details)

Стандарт: MIME-тип `application/problem+json`, единая форма для **всех** 4xx/5xx.

```jsonc
{
  "type": "https://rest-api-forge.local/problems/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "Request validation failed",
  "instance": "/api/v1/users",
  "invalidParams": [
    { "path": "email", "message": "Invalid email" },
    { "path": "name", "message": "String must contain at least 2 characters" }
  ]
}
```

Правила:
- **400** — `invalidParams` из Zod (`error.issues`).
- **401/403/404/409** — `detail` человекочитаемый, без утечек (не «user with id 5 exists in table users»).
- **500** — фиксированный текст, детали только в серверный лог (request id!).

Реализация — централизованный **error handler** в конце middleware-цепочки (§9): один слой формирует формат, контроллеры просто `throw new NotFoundError('...')`.

---

## 7. Версионирование

| Подход | Пример | Оценка |
|---|---|---|
| **В URL** | `/api/v1/users` | ✅ выбран: явно, проксируется, видно в логах |
| В header | `Accept: application/vnd.api.v1+json` | чище для REST-пуристов, неудобно отлаживать |
| По хосту | `v1.api.example.com` | дорого в инфраструктуре |

Версию меняем только при **breaking change** (смена смысла поля, удаление эндпоинта). Добавление опционального поля — не breaking, версию не трогаем.

---

## 8. Аутентификация и авторизация

- **Аутентификация** — «кто ты» (login → JWT). **Авторизация** — «что тебе можно» (роли, владение ресурсом).
- **Stateless + JWT**: сервер не хранит сессии — токен подписывается секретом, валидируется подписью. Для API-шаблона это база.
- **Bearer-схема**:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

- **Срок жизни**: access-токен короткий (15 мин–1 ч). Refresh-токены — post-MVP (нужно хранилище для ротации).
- **Пароли**: только `bcrypt`-хеш (`bcrypt.hash(pw, 10)`), никогда не `md5/sha*`. Наружу хеш не уходит **никогда**.
- **Роли**: `user` | `admin` → middlewares `requireAuth` → `requireRole('admin')`.
- **Владение ресурсом**: `PATCH /users/:id` — автор должен быть владельцем *или* admin; иначе **403**.

Почему не cookie-сессии: для SPA/mobile API проще JWT; trade-off — невозможно мгновенно «разлогинить», поэтому короткий TTL.

---

## 9. Архитектура на Node.js: слои и поток запроса

### Поток

```
HTTP → [pino-http лог] → [auth] → [validate(Zod)] → routes
     → controller (только HTTP: req/res, try не нужен — Express 5)
       → service (бизнес-логика, транзакции, кидает AppError)
         → repository (SQL через Drizzle, чистые данные)
     ← error handler (все throw → RFC 9457)
```

### Слои

| Слой | Файл | Что делает | Что НЕ делает |
|---|---|---|---|
| **Routes** | `*.routes.ts` | метод + URL + цепочка middleware | логика |
| **Controller** | `*.controller.ts` | достаёт данные из req, вызывает service, шлёт res | бизнес-логика, SQL |
| **Service** | `*.service.ts` | правила, транзакции, кидает ошибки | не знает про Express и Drizzle-типы |
| **Repository** | `*.repository.ts` | SQL/ORM-запросы, возвращает entity | не знает про HTTP-коды |
| **Schemas** | `*.schemas.ts` | Zod-схемы → типы request/response | — |

Зачем так много слоёв для маленького проекта? Потому что учебный: каждое правило видно отдельно. На проде слой `service` оправдан, если есть логика; CRUD-обёртка из 4 вызовов — допустимо склеить controller+service до размера (но не repository).

### Dependency injection «руками»

```ts
// app.ts — фабрика, тесты подменяют repository
export interface AppDeps {
  usersRepo: UsersRepository;
  authService: AuthService;
}
export function createApp(deps: AppDeps): express.Express { ... }

// server.ts — production-сборка
const app = createApp({ usersRepo: new DrizzleUsersRepository(db), ... });

// *.test.ts — тест без БД
const app = createApp({ usersRepo: new InMemoryUsersRepository(), ... });
```

Без `reflect-metadata` и decorator-магии — просто функция с аргументами.

---

## 10. Типизация Express + TypeScript

Express «нативно» не типобезопасен: `req.body` — `any`. Три уровня защиты:

### 1) Расширение `Request`

```ts
// src/types/express.d.ts
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;       // подставляет requireAuth
      validated?: { body?: unknown; query?: unknown; params?: unknown };
    }
  }
}
```

### 2) Zod-inference вместо ручных интерфейсов

```ts
export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;
// тип и валидация из одного источника — не рассинхронятся
```

### 3) Валидация на входе → сужение типа

```ts
router.post('/', validate({ body: createUserSchema }), (req, res) => {
  const input = req.body as CreateUserInput; // после validate гарантированно валиден
});
```

**Никогда** не писать `as` для того, что не проверено в рантайме — типы уходят от реальности («trust boundary»: проверил → дальше доверяй).

Рантайм-проверки обязательны: TypeScript исчезает после компиляции, JSON от клиента — любой.

---

## 11. Валидация (Zod на границе)

```ts
// schemas
const patchUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  role: z.enum(['user', 'admin']).optional(),
}).refine(v => Object.keys(v).length > 0, { message: 'Empty body' });

// middleware — один раз для всех роутов
validate({ body: patchUserSchema, query: listQuerySchema })
```

- **Query-параметры** приходят строками: `z.coerce.number().int().min(1)` приводит `?page=2` → `2` и отбрасывает мусор.
- Схемы переиспользуются: та же `createUserSchema` используется в service-тестах.
- Нельзя доверять ни одному полю, включая `:id` из URL (`z.string().uuid()`).

---

## 12. Безопасность и надёжность

| Мера | Как | Зачем |
|---|---|---|
| **CORS** | `cors()` с whitelist origin'ов (`origin: env.CORS_ORIGINS`) | чужой сайт не должен достучаться с браузера пользователя |
| **Rate limiting** | `express-rate-limit` на `/auth/*` | перебор паролей (brute force) |
| **Helmet** | заголовки безопасности | снять типовые header-заголовки |
| **Идемпотентность POST** | header `Idempotency-Key` + сохранение результата | повтор таймаута не создаст дубль |
| **Пагинация ≤100** | лимит в query-схеме | защита от «выгрузи всю таблицу» |
| **Секреты в env** | Zod-валидация env на старте | JWT_SECRET не в git |
| **Сравнение токенов** | `crypto.timingSafeEqual` (или доверить библиотеке) | защита от timing-атак |

---

## 13. OpenAPI

OpenAPI-документ (бывший Swagger) — машиночитаемое описание API: эндпоинты, схемы, коды ответов.

- Источник истины — **Zod-схемы**: генерация `openapi.json` из тех же схем, что валидируют запросы → документ не расходится с кодом.
- Выдаём `GET /api/v1/openapi.json`, в Swagger UI (CDN) можно «поиграть» API из браузера.
- Для команды/клиентов из документа генерируется SDK.

---

## 14. Тестирование

```ts
// e2e через HTTP без запуска порта
const app = createApp(testDeps);
const server = app.listen(0);
const res = await request(server).get('/api/v1/health').expect(200);
```

- **Vitest** — runner (ESM-натуральный, быстрее Jest).
- **supertest** — оборачивает `app` без реального порта (или с ephemeral).
- Тесты без БД: in-memory repository подставляется через `createApp(deps)`.
- Минимальный набор шаблона: health, валидация (400 + `invalidParams`), CRUD через in-memory, auth-кейсы (401/403), формат ошибок.
- Пирамида: unit (service) > e2e (HTTP) > интеграционные с БД (отдельный набор, opt-in).

---

## 15. Anti-patterns

| ❌ Плохо | ✅ Хорошо |
|---|---|
| `POST /getUser`, `?action=delete` | Нормальные методы на ресурсах |
| Строковые коды вида `{ code: 200, result: "ok" }` внутри 200 | Настоящие HTTP-статусы |
| Смешанные форматы ошибок по эндпоинтам | Один error handler на всё |
| SQL и бизнес-логика в `routes` | Слои; repository — единственное место с SQL |
| `any` и «спасительные» `as` | Zod-inference |
| Глубокая вложенность URL `/a/:id/b/:id/c/:id` | Максимум один уровень |
| Логин в query `?token=...` | Только `Authorization` header |
| Отдавать `stack trace` при 500 | Лог серверно, наружу — request id |
| Ручной дубль «тип + валидация» | Один Zod-источник |

---

## Чек-лист проектирования нового эндпоинта

1. Ресурс — существительное, plural, в `/api/v1/`?
2. Метод и семантика верны (GET без побочек, POST→201, DELETE→204)?
3. Схема Zod написана для body/query/params?
4. Ответ — `{ data }` / `{ data, meta }`, ошибка — RFC 9457?
5. Статусы: 400 валидация, 401 нет токена, 403 нет прав, 404 нет ресурса, 409 конфликт?
6. Пагинация с лимитом `perPage`?
7. Авторизация/владение проверены (`requireAuth` + ownership/role)?
8. OpenAPI-описание обновлено?
9. Тест: happy path + 400 + 401/403 + 404?
10. Нет ли `password_hash`/секретов в ответе?
