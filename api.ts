import process from "node:process";
import { appFactory } from "@versia-server/api";
import { config } from "@versia-server/config";
import { Youch } from "youch";
import { createServer } from "@/server.ts";

process.on("SIGINT", () => {
    process.exit();
});

process.on("uncaughtException", async (error) => {
    const youch = new Youch();

    console.error(await youch.toANSI(error));
});

await import("@versia-server/api/setup");

createServer(config, await appFactory());
