import { getLogger } from "@logtape/logtape";
import chalk from "chalk";
import { createMiddleware } from "hono/factory";
import { config } from "~/config.ts";

export const logger = createMiddleware(async (context, next) => {
    if (config.logging.types.requests) {
        const serverLogger = getLogger("server");
        const body = await context.req.raw.clone().text();

        const urlAndMethod = `${chalk.green(context.req.method)} ${chalk.blue(context.req.url)}`;

        const hash = `${chalk.bold("Hash")}: ${chalk.yellow(
            new Bun.SHA256().update(body).digest("hex"),
        )}`;

        const headers = `${chalk.bold("Headers")}:\n${Array.from(
            context.req.raw.headers.entries(),
        )
            .map(
                ([key, value]) =>
                    ` - ${chalk.cyan(key)}: ${chalk.white(value)}`,
            )
            .join("\n")}`;

        const bodyLog = `${chalk.bold("Body")}: ${chalk.gray(body)}`;

        if (config.logging.types.requests_content) {
            serverLogger.debug`${urlAndMethod}\n${hash}\n${headers}\n${bodyLog}`;
        } else {
            serverLogger.debug`${urlAndMethod}`;
        }
    }

    await next();
});
