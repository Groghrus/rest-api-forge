import type { RequestHandler } from "express";

import { PROBLEM_BASE_URL } from "../common/errors.js";

export const notFoundHandler: RequestHandler = (req, res) => {
  res
    .status(404)
    .type("application/problem+json")
    .json({
      type: `${PROBLEM_BASE_URL}/not-found`,
      title: "Not Found",
      status: 404,
      detail: `Route ${req.method} ${req.originalUrl} not found`,
      instance: req.originalUrl,
    });
};
