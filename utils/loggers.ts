import { config } from "~packages/config-manager";
import { LogManager, MultiLogManager } from "log-manager";

const noColors = process.env.NO_COLORS === "true";
const noFancyDates = process.env.NO_FANCY_DATES === "true";

const requests_log = Bun.file(config.logging.storage.requests);
const isEntry = true;

export const logger = new LogManager(
    isEntry ? requests_log : Bun.file("/dev/null"),
);
export const consoleLogger = new LogManager(
    isEntry ? Bun.stdout : Bun.file("/dev/null"),
    !noColors,
    !noFancyDates,
);

export const dualLogger = new MultiLogManager([logger, consoleLogger]);
