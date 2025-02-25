import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { getRotatingFileSink } from "@logtape/file";
import {
    type LogLevel,
    type LogRecord,
    configure,
    getConsoleSink,
    getLevelFilter,
} from "@logtape/logtape";
import chalk from "chalk";
import { config } from "~/config.ts";

// config.logging.log_file_path is a path to a file, create the directory if it doesn't exist
await mkdir(dirname(config.logging.log_file_path), { recursive: true });

const levelAbbreviations: Record<LogLevel, string> = {
    debug: "DBG",
    info: "INF",
    warning: "WRN",
    error: "ERR",
    fatal: "FTL",
};

/**
 * The styles for the log level in the console.
 */
const logLevelStyles: Record<LogLevel, (text: string) => string> = {
    debug: chalk.white.bgGray,
    info: chalk.black.bgWhite,
    warning: chalk.black.bgYellow,
    error: chalk.white.bgRed,
    fatal: chalk.white.bgRedBright,
};

/**
 * The default console formatter.
 *
 * @param record The log record to format.
 * @returns The formatted log record, as an array of arguments for
 * {@link console.log}.
 */
export function defaultConsoleFormatter(record: LogRecord): string[] {
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

export const configureLoggers = (silent = false): Promise<void> =>
    configure({
        reset: true,
        sinks: {
            console: getConsoleSink({
                formatter: defaultConsoleFormatter,
            }),
            file: getRotatingFileSink(config.logging.log_file_path, {
                maxFiles: 10,
                maxSize: 10 * 1024 * 1024,
            }),
        },
        filters: {
            configFilter: silent
                ? getLevelFilter(null)
                : getLevelFilter(config.logging.log_level),
        },
        loggers: [
            {
                category: "server",
                sinks: ["console", "file"],
                filters: ["configFilter"],
            },
            {
                category: ["federation", "inbox"],
                sinks: ["console", "file"],
                filters: ["configFilter"],
            },
            {
                category: ["federation", "delivery"],
                sinks: ["console", "file"],
                filters: ["configFilter"],
            },
            {
                category: ["federation", "bridge"],
                sinks: ["console", "file"],
                filters: ["configFilter"],
            },
            {
                category: ["federation", "resolvers"],
                sinks: ["console", "file"],
                filters: ["configFilter"],
            },
            {
                category: ["federation", "messaging"],
                sinks: ["console", "file"],
                filters: ["configFilter"],
            },
            {
                category: "database",
                sinks: ["console", "file"],
                filters: ["configFilter"],
            },
            {
                category: "webfinger",
                sinks: ["console", "file"],
                filters: ["configFilter"],
            },
            {
                category: "sonic",
                sinks: ["console", "file"],
                filters: ["configFilter"],
            },
            {
                category: ["logtape", "meta"],
                lowestLevel: "error",
            },
            {
                category: "plugin",
                sinks: ["console", "file"],
                filters: ["configFilter"],
            },
        ],
    });
