export const PROBLEM_BASE_URL = "https://rest-api-forge.dev/problems";

export interface InvalidParam {
  path: string;
  message: string;
}

/**
 * Единый тип ошибок приложения.
 * Контроллеры и middleware кидают наружу только экземпляры AppError —
 * централизованный error-handler превращает их в RFC 9457 problem+json.
 */
export class AppError extends Error {
  readonly status: number;
  readonly problemType: string;
  readonly invalidParams?: InvalidParam[];

  constructor(
    status: number,
    problemType: string,
    message: string,
    invalidParams?: InvalidParam[],
  ) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.problemType = problemType;
    this.invalidParams = invalidParams;
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", invalidParams?: InvalidParam[]) {
    super(400, "bad-request", message, invalidParams);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(401, "unauthorized", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Insufficient permissions") {
    super(403, "forbidden", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(404, "not-found", message);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource already exists") {
    super(409, "conflict", message);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = "Too many requests, please try again later") {
    super(429, "too-many-requests", message);
  }
}

export class InternalError extends AppError {
  constructor(message = "Internal server error") {
    super(500, "internal", message);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
