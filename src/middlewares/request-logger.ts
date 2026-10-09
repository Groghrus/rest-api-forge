import { pinoHttp } from "pino-http";

import { logger } from "../common/logger.js";
import { env } from "../config/env.js";

export const requestLogger = pinoHttp({
  logger,
  autoLogging: env.NODE_ENV !== "test",
});
