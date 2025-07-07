import type { LogLevel, LogRecord } from "@logtape/logtape";
import chalk, { type ChalkInstance } from "chalk";

const levelAbbreviations: Record<LogLevel, string> = {
    debug: "DBG",
    info: "INF",
    warning: "WRN",
    error: "ERR",
    fatal: "FTL",
    trace: "TRC",
};

/**
 * The styles for the log level in the console.
 */
const logLevelStyles: Record<LogLevel, ChalkInstance> = {
    debug: chalk.white.bgGray,
    info: chalk.black.bgWhite,
    warning: chalk.black.bgYellow,
    error: chalk.white.bgRed,
    fatal: chalk.white.bgRedBright,
    trace: chalk.white.bgBlue,
};

/**
 * Pretty colored console formatter.
 *
 * @param record The log record to format.
 * @returns The formatted log record, as an array of arguments for
 * {@link console.log}.
 */
export function consoleFormatter(record: LogRecord): string[] {
    const msg = record.message.join("");
    const date = new Date(record.timestamp);
    const time = `${date.getUTCHours().toString().padStart(2, "0")}:${date
        .getUTCMinutes()
        .toString()
        .padStart(
            2,
            "0",
        )}:${date.getUTCSeconds().toString().padStart(2, "0")}.${date
        .getUTCMilliseconds()
        .toString()
        .padStart(3, "0")}`;

    const formattedTime = chalk.gray(time);
    const formattedLevel = logLevelStyles[record.level](
        levelAbbreviations[record.level],
    );
    const formattedCategory = chalk.gray(record.category.join("\xb7"));
    const formattedMsg = chalk.reset(msg);

    return [
        `${formattedTime} ${formattedLevel} ${formattedCategory} ${formattedMsg}`,
    ];
}
