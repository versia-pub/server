import process from "node:process";
import { serverLogger } from "@versia-server/logging";
import chalk from "chalk";
import { workers } from "./workers.ts";

process.on("SIGINT", () => {
    process.exit();
});

await import("./setup.ts");

for (const [worker, fn] of Object.entries(workers)) {
    serverLogger.info`Starting ${worker} Worker...`;
    fn();
    serverLogger.info`${chalk.green("✔")} ${worker} Worker started`;
}

serverLogger.info`${chalk.green("✔✔✔✔✔✔")} All workers started`;
