import {
    appendFileSync,
    closeSync,
    existsSync,
    mkdirSync,
    openSync,
    renameSync,
    statSync,
} from "node:fs";
import {
    type LogLevel,
    type LogRecord,
    type RotatingFileSinkOptions,
    type Sink,
    configure,
    getConsoleSink,
    getLevelFilter,
} from "@logtape/logtape";
import chalk from "chalk";
import stripAnsi from "strip-ansi";
import { config } from "~/packages/config-manager";

// HACK: This is a workaround for the lack of type exports in the Logtape package.
type RotatingFileSinkDriver<T> =
    import("../node_modules/@logtape/logtape/logtape/sink").RotatingFileSinkDriver<T>;

// HACK: Stolen
export function getBaseRotatingFileSink<TFile>(
    path: string,
    options: RotatingFileSinkOptions & RotatingFileSinkDriver<TFile>,
): Sink & Disposable {
    const formatter = options.formatter ?? defaultTextFormatter;
    const encoder = options.encoder ?? new TextEncoder();
    const maxSize = options.maxSize ?? 1024 * 1024;
    const maxFiles = options.maxFiles ?? 5;
    let { size: offset } = options.statSync(path);
    let fd = options.openSync(path);
    function shouldRollover(bytes: Uint8Array): boolean {
        return offset + bytes.length > maxSize;
    }
    function performRollover(): void {
        options.closeSync(fd);
        for (let i = maxFiles - 1; i > 0; i--) {
            const oldPath = `${path}.${i}`;
            const newPath = `${path}.${i + 1}`;
            try {
                options.renameSync(oldPath, newPath);
            } catch (_) {
                // Continue if the file does not exist.
            }
        }
        options.renameSync(path, `${path}.1`);
        offset = 0;
        fd = options.openSync(path);
    }
    const sink: Sink & Disposable = (record: LogRecord) => {
        const bytes = encoder.encode(formatter(record));
        if (shouldRollover(bytes)) {
            performRollover();
        }
        options.writeSync(fd, bytes);
        options.flushSync(fd);
        offset += bytes.length;
    };
    sink[Symbol.dispose] = () => options.closeSync(fd);
    return sink;
}

const levelAbbreviations: Record<LogLevel, string> = {
    debug: "DBG",
    info: "INF",
    warning: "WRN",
    error: "ERR",
    fatal: "FTL",
};

export function defaultTextFormatter(record: LogRecord): string {
    const ts = new Date(record.timestamp);
    let msg = "";
    for (let i = 0; i < record.message.length; i++) {
        if (i % 2 === 0) {
            msg += record.message[i];
        } else {
            msg += Bun.inspect(stripAnsi(record.message[i] as string)).match(
                /"(.*?)"/,
            )?.[1];
        }
    }
    const category = record.category.join("\xb7");
    return `${ts.toISOString().replace("T", " ").replace("Z", " +00:00")} [${
        levelAbbreviations[record.level]
    }] ${category}: ${msg}\n`;
}

/**
 * A console formatter is a function that accepts a log record and returns
 * an array of arguments to pass to {@link console.log}.
 *
 * @param record The log record to format.
 * @returns The formatted log record, as an array of arguments for
 *          {@link console.log}.
 */
export type ConsoleFormatter = (record: LogRecord) => readonly unknown[];

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
 *          {@link console.log}.
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

export const nodeDriver: RotatingFileSinkDriver<number> = {
    openSync(path: string) {
        return openSync(path, "a");
    },
    writeSync(fd, chunk) {
        appendFileSync(fd, chunk, {
            flush: true,
        });
    },
    flushSync() {
        // ...
    },
    closeSync(fd) {
        closeSync(fd);
    },
    statSync(path) {
        // If file does not exist, create it
        if (!existsSync(path)) {
            // Mkdir all directories in path
            const dirs = path.split("/");
            dirs.pop();
            mkdirSync(dirs.join("/"), { recursive: true });
            appendFileSync(path, "");
        }
        return statSync(path);
    },
    renameSync: renameSync,
};

export const configureLoggers = (silent = false) =>
    configure({
        reset: true,
        sinks: {
            console: getConsoleSink({
                formatter: defaultConsoleFormatter,
            }),
            file: getBaseRotatingFileSink(config.logging.storage.requests, {
                maxFiles: 10,
                maxSize: 10 * 1024 * 1024,
                formatter: defaultTextFormatter,
                ...nodeDriver,
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
                category: "federation",
                sinks: ["console", "file"],
                filters: ["configFilter"],
            },
            {
                category: ["federation", "inbox"],
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
                category: "meilisearch",
                sinks: ["console", "file"],
                filters: ["configFilter"],
            },
            {
                category: ["logtape", "meta"],
                level: "error",
            },
        ],
    });
