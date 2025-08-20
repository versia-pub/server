import { config } from "@versia-server/config";
import type { Config } from "drizzle-kit";

/**
 * Drizzle can't properly resolve imports with top-level await, so uncomment
 * this line when generating migrations.
 */
export default {
    dialect: "postgresql",
    out: "./packages/kit/tables/migrations",
    schema: "./packages/kit/tables/schema.ts",
    dbCredentials: {
        /* host: "localhost",
        port: 40000,
        user: "lysand",
        password: "lysand",
        database: "lysand", */
        host: config.postgres.host,
        port: config.postgres.port,
        user: config.postgres.username,
        password: config.postgres.password,
        database: config.postgres.database,
    },
    // Print all statements
    verbose: true,
    // Always ask for confirmation
    strict: true,
} satisfies Config;
