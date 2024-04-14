import { LogManager, MultiLogManager } from "log-manager";
import { config } from "config-manager";

const noColors = process.env.NO_COLORS === "true";
const noFancyDates = process.env.NO_FANCY_DATES === "true";

const requests_log = Bun.file(config.logging.storage.requests);

export const logger = new LogManager(
    true ? requests_log : Bun.file("/dev/null"),
);
export const consoleLogger = new LogManager(
    true ? Bun.stdout : Bun.file("/dev/null"),
    !noColors,
    !noFancyDates,
);

export const dualLogger = new MultiLogManager([logger, consoleLogger]);
