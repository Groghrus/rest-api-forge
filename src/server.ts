import { createApp } from "./app.js";
import { logger } from "./common/logger.js";
import { env } from "./config/env.js";
import { createDatabase } from "./db/client.js";
import { DrizzleUsersRepository } from "./modules/users/users.repository.drizzle.js";

async function main(): Promise<void> {
  const { db, pool } = createDatabase(env.DATABASE_URL);

  try {
    await pool.query("SELECT 1");
    logger.info("database connection established");
  } catch (error) {
    logger.fatal({ err: error }, "cannot connect to database");
    process.exit(1);
  }

  const app = createApp({
    usersRepository: new DrizzleUsersRepository(db),
    checkDatabase: async () => {
      try {
        await pool.query("SELECT 1");
        return true;
      } catch {
        return false;
      }
    },
  });

  const server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV },
      `server is running: http://localhost:${env.PORT}/api/v1`,
    );
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, "shutting down");
    server.close(() => {
      void pool.end().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, "startup failed");
  process.exit(1);
});
