import process from "node:process";
import { serverLogger } from "@versia-server/logging";
import { workers } from "@versia-server/worker";
import chalk from "chalk";

process.on("SIGINT", () => {
    process.exit();
});

await import("@versia-server/worker/setup");

for (const [worker, fn] of Object.entries(workers)) {
    serverLogger.info`Starting ${worker} Worker...`;
    fn();
    serverLogger.info`${chalk.green("✔")} ${worker} Worker started`;
}

serverLogger.info`${chalk.green("✔✔✔✔✔✔")} All workers started`;
