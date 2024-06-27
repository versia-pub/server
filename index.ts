import { createServer } from "@/server";
import { config } from "config-manager";
import { appFactory } from "~/app";
import { setupDatabase } from "./drizzle/db";

if (import.meta.main) {
    await import("./setup");
}

await setupDatabase();

createServer(config, await appFactory());
