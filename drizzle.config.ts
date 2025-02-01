import type { Config } from "drizzle-kit";
import { config } from "./packages/config-manager/index.ts";

/**
 * Drizzle can't properly resolve imports with top-level await, so uncomment
 * this line when generating migrations.
 */
export default {
    dialect: "postgresql",
    out: "./drizzle/migrations",
    schema: "./drizzle/schema.ts",
    dbCredentials: {
        /* host: "localhost",
        port: 40000,
        user: "lysand",
        password: "lysand",
        database: "lysand", */
        host: config.database.host,
        port: Number(config.database.port),
        user: config.database.username,
        password: config.database.password,
        database: config.database.database,
    },
    // Print all statements
    verbose: true,
    // Always ask for confirmation
    strict: true,
} satisfies Config;
