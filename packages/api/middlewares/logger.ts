import { serverLogger } from "@versia-server/logging";
import { SHA256 } from "bun";
import chalk from "chalk";
import { createMiddleware } from "hono/factory";

export const logger = createMiddleware(async (context, next) => {
    const body = await context.req.raw.clone().text();

    const urlAndMethod = `${chalk.green(context.req.method)} ${chalk.blue(context.req.url)}`;

    const hash = `${chalk.bold("Hash")}: ${chalk.yellow(
        new SHA256().update(body).digest("hex"),
    )}`;

    const headers = `${chalk.bold("Headers")}:\n${Array.from(
        context.req.raw.headers.entries(),
    )
        .map(([key, value]) => ` - ${chalk.cyan(key)}: ${chalk.white(value)}`)
        .join("\n")}`;

    const bodyLog = `${chalk.bold("Body")}: ${chalk.gray(body)}`;

    serverLogger.debug`${urlAndMethod}\n${hash}\n${headers}\n${bodyLog}`;

    await next();
});
