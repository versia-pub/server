import { createMiddleware } from "@hono/hono/factory";
import { getLogger } from "@logtape/logtape";
import chalk from "chalk";
import { config } from "~/packages/config-manager";

export const logger = createMiddleware(async (context, next) => {
    if (config.logging.log_requests) {
        const logger = getLogger("server");
        const body = await context.req.text();

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

        if (config.logging.log_requests_verbose) {
            logger.debug`${urlAndMethod}\n${hash}\n${headers}\n${bodyLog}`;
        } else {
            logger.debug`${urlAndMethod}`;
        }
    }

    await next();
});
