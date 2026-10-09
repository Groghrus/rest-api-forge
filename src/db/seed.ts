import { hashPassword } from "../common/password.js";
import { logger } from "../common/logger.js";
import { env } from "../config/env.js";
import { DrizzleUsersRepository } from "../modules/users/users.repository.drizzle.js";
import { createDatabase } from "./client.js";

async function main(): Promise<void> {
  const { db, pool } = createDatabase(env.DATABASE_URL);
  const repository = new DrizzleUsersRepository(db);

  const existing = await repository.findByEmail(env.ADMIN_EMAIL);
  if (existing) {
    logger.info({ email: env.ADMIN_EMAIL }, "admin already exists");
    await pool.end();
    return;
  }

  const admin = await repository.create({
    email: env.ADMIN_EMAIL,
    name: "Admin",
    passwordHash: await hashPassword(env.ADMIN_PASSWORD),
    role: "admin",
  });

  logger.info(
    { email: admin.email, id: admin.id },
    "admin user created (change ADMIN_PASSWORD in .env!)",
  );
  await pool.end();
}

main().catch((error: unknown) => {
  logger.error({ err: error }, "seed failed");
  process.exit(1);
});
