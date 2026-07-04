import { defineConfig } from "drizzle-kit";

// Migrations run from Node scripts, which do NOT auto-load .env.local — invoke via
// `npx dotenv -e .env.local -- npx drizzle-kit <cmd>` (see package.json db scripts).
export default defineConfig({
  schema: "./src/lib/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Use the unpooled connection for migrations (DDL over a direct connection).
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!,
  },
});
