import process from "node:process";
import { getLogger } from "@logtape/logtape";
import chalk from "chalk";
import { sentry } from "@/sentry";
import { workers } from "./workers.ts";

process.on("SIGINT", () => {
    process.exit();
});

await import("./setup.ts");
sentry?.captureMessage("Server started", "info");

const serverLogger = getLogger("server");

for (const [worker, fn] of Object.entries(workers)) {
    serverLogger.info`Starting ${worker} Worker...`;
    fn();
    serverLogger.info`${chalk.green("✔")} ${worker} Worker started`;
}

serverLogger.info`${chalk.green("✔✔✔✔✔✔")} All workers started`;
