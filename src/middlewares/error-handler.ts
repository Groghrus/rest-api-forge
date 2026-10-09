import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

import {
  AppError,
  BadRequestError,
  ConflictError,
  InternalError,
  PROBLEM_BASE_URL,
  isAppError,
  type InvalidParam,
} from "../common/errors.js";
import { logger } from "../common/logger.js";

const STATUS_TITLES: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  413: "Payload Too Large",
  429: "Too Many Requests",
  500: "Internal Server Error",
  503: "Service Unavailable",
};

const STATUS_SLUGS: Record<number, string> = {
  400: "bad-request",
  401: "unauthorized",
  403: "forbidden",
  404: "not-found",
  409: "conflict",
  413: "payload-too-large",
  429: "too-many-requests",
  500: "internal",
  503: "service-unavailable",
};

function toInvalidParams(error: ZodError): InvalidParam[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join(".") || "(root)",
    message: issue.message,
  }));
}

interface HttpError extends Error {
  status?: number;
  statusCode?: number;
  type?: string;
  code?: string;
}

function isHttpError(error: unknown): error is HttpError {
  return (
    error instanceof Error && typeof (error as HttpError).status === "number"
  );
}

/**
 * Единственный обработчик ошибок на всё приложение.
 * Любой throw/next(err) в ходе запроса превращается в RFC 9457 problem+json.
 */
export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  let appError: AppError;

  if (error instanceof ZodError) {
    appError = new BadRequestError(
      "Request validation failed",
      toInvalidParams(error),
    );
  } else if (isAppError(error)) {
    appError = error;
  } else if (isHttpError(error) && isClientErrorStatus(error.status)) {
    // ошибки body-parser (malformed JSON, payload too large) и подобные
    const status = error.status ?? 400;
    const message =
      error.type === "entity.parse.failed"
        ? "Malformed JSON body"
        : "Bad request";
    appError = new AppError(status, slugForStatus(status), message);
  } else if (isPgUniqueViolation(error)) {
    appError = new ConflictError("Resource already exists");
  } else {
    logger.error({ err: error }, "unhandled error");
    appError = new InternalError();
  }

  if (appError.status >= 500) {
    logger.error({ err: error, status: appError.status }, appError.message);
  }

  res
    .status(appError.status)
    .type("application/problem+json")
    .json({
      type: `${PROBLEM_BASE_URL}/${appError.problemType}`,
      title: STATUS_TITLES[appError.status] ?? "Error",
      status: appError.status,
      detail: appError.message,
      instance: req.originalUrl,
      ...(appError.invalidParams
        ? { invalidParams: appError.invalidParams }
        : {}),
    });
};

function isClientErrorStatus(status: number | undefined): boolean {
  return status !== undefined && status >= 400 && status < 500;
}

function slugForStatus(status: number): string {
  return STATUS_SLUGS[status] ?? String(status);
}

function isPgUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "23505"
  );
}
