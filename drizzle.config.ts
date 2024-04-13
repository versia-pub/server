import { config } from "config-manager";
import type { Config } from "drizzle-kit";

export default {
    driver: "pg",
    out: "./drizzle",
    schema: "./drizzle/schema.ts",
    dbCredentials: {
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
