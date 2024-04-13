import { config } from "config-manager";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import * as schema from "./schema";

export const client = new Client({
    host: config.database.host,
    port: Number(config.database.port),
    user: config.database.username,
    password: config.database.password,
    database: config.database.database,
});

export const db = drizzle(client, { schema });
