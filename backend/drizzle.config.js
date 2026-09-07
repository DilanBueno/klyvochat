import { defineConfig } from "drizzle-kit";
import "dotenv/config";
export default defineConfig({
    dialect: "sqlite",
    schema: "./src/db/schema.ts",
    out: "./drizzle",
    dbCredentials: {
        url: process.env.DATABASE_PATH || "./data/klyvochat.db",
    },
});
