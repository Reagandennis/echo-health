import { readFileSync } from "node:fs";
import type { Config } from "drizzle-kit";

/**
 * drizzle-kit runs outside Next.js, so it does not pick up `.env.local`
 * automatically. Parse it here rather than pulling in `dotenv` for one variable.
 */
function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  try {
    const line = readFileSync(".env.local", "utf8")
      .split("\n")
      .find((l) => l.startsWith("DATABASE_URL="));
    if (line) return line.slice("DATABASE_URL=".length).trim();
  } catch {
    // fall through to the error below
  }

  throw new Error("DATABASE_URL is not set (checked process.env and .env.local)");
}

export default {
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: databaseUrl() },
  // Azure Database for PostgreSQL ships these; they are not ours to manage.
  schemaFilter: ["public"],
  verbose: true,
  strict: true,
} satisfies Config;
