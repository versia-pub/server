import process from "node:process";
import { Youch } from "youch";
import { sentry } from "@/sentry";
import { createServer } from "@/server";
import { appFactory } from "~/app";
import { config } from "~/config.ts";

process.on("SIGINT", () => {
    process.exit();
});

process.on("uncaughtException", async (error) => {
    const youch = new Youch();

    console.error(await youch.toANSI(error));
});

await import("~/entrypoints/api/setup.ts");
sentry?.captureMessage("Server started", "info");

createServer(config, await appFactory());
