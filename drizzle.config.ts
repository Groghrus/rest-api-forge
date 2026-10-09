import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile();
} catch {
  // .env отсутствует — используем значение по умолчанию
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgres://postgres:postgres@localhost:5432/rest_api_forge",
  },
});
