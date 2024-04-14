import { appendFile, exists, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { BunFile } from "bun";
import chalk from "chalk";
import { config } from "config-manager";

export enum LogLevel {
    DEBUG = "debug",
    INFO = "info",
    WARNING = "warning",
    ERROR = "error",
    CRITICAL = "critical",
}

const logOrder = [
    LogLevel.DEBUG,
    LogLevel.INFO,
    LogLevel.WARNING,
    LogLevel.ERROR,
    LogLevel.CRITICAL,
];

/**
 * Class for handling logging to disk or to stdout
 * @param output BunFile of output (can be a normal file or something like Bun.stdout)
 */
export class LogManager {
    constructor(
        private output: BunFile,
        private enableColors = false,
        private prettyDates = false,
    ) {
        /* void this.write(
            `--- INIT LogManager at ${new Date().toISOString()} ---`,
        ); */
    }

    getLevelColor(level: LogLevel) {
        switch (level) {
            case LogLevel.DEBUG:
                return chalk.blue;
            case LogLevel.INFO:
                return chalk.green;
            case LogLevel.WARNING:
                return chalk.yellow;
            case LogLevel.ERROR:
                return chalk.red;
            case LogLevel.CRITICAL:
                return chalk.bgRed;
        }
    }

    getFormattedDate(date: Date = new Date()) {
        return this.prettyDates
            ? date.toLocaleString(undefined, {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
              })
            : date.toISOString();
    }

    /**
     * Logs a message to the output
     * @param level Importance of the log
     * @param entity Emitter of the log
     * @param message Message to log
     * @param showTimestamp Whether to show the timestamp in the log
     */
    async log(
        level: LogLevel,
        entity: string,
        message: string,
        showTimestamp = true,
    ) {
        if (
            logOrder.indexOf(level) <
            logOrder.indexOf(config.logging.log_level as LogLevel)
        )
            return;

        if (this.enableColors) {
            await this.write(
                `${
                    showTimestamp
                        ? `${chalk.gray(this.getFormattedDate())} `
                        : ""
                }[${this.getLevelColor(level)(
                    level.toUpperCase(),
                )}] ${chalk.bold(entity)}: ${message}`,
            );
        } else {
            await this.write(
                `${
                    showTimestamp ? `${this.getFormattedDate()} ` : ""
                }[${level.toUpperCase()}] ${entity}: ${message}`,
            );
        }
    }

    private async write(text: string) {
        Bun.stdout.name;
        if (this.output === Bun.stdout) {
            await console.log(`${text}`);
        } else {
            if (!(await exists(this.output.name ?? ""))) {
                // Create file if it doesn't exist
                try {
                    await mkdir(dirname(this.output.name ?? ""), {
                        recursive: true,
                    });
                    this.output = Bun.file(this.output.name ?? "");
                } catch {
                    //
                }
            }
            await appendFile(this.output.name ?? "", `${text}\n`);
        }
    }

    /**
     * Logs an error to the output, wrapper for log
     * @param level Importance of the log
     * @param entity Emitter of the log
     * @param error Error to log
     */
    async logError(level: LogLevel, entity: string, error: Error) {
        error.stack && (await this.log(LogLevel.DEBUG, entity, error.stack));
        await this.log(level, entity, error.message);
    }

    /**
     * Logs a request to the output
     * @param req Request to log
     * @param ip IP of the request
     * @param logAllDetails Whether to log all details of the request
     */
    async logRequest(req: Request, ip?: string, logAllDetails = false) {
        let string = ip ? `${ip}: ` : "";

        string += `${req.method} ${req.url}`;

        if (logAllDetails) {
            string += "\n";
            string += "  [Headers]\n";
            // Pretty print headers
            for (const [key, value] of req.headers.entries()) {
                string += `    ${key}: ${value}\n`;
            }

            // Pretty print body
            string += "  [Body]\n";
            const content_type = req.headers.get("Content-Type");

            if (content_type?.includes("application/json")) {
                try {
                    const json = await req.clone().json();
                    const stringified = JSON.stringify(json, null, 4)
                        .split("\n")
                        .map((line) => `    ${line}`)
                        .join("\n");

                    string += `${stringified}\n`;
                } catch {
                    string += `    [Invalid JSON] (raw: ${await req
                        .clone()
                        .text()})\n`;
                }
            } else if (
                content_type &&
                (content_type.includes("application/x-www-form-urlencoded") ||
                    content_type.includes("multipart/form-data"))
            ) {
                const formData = await req.clone().formData();
                for (const [key, value] of formData.entries()) {
                    if (value.toString().length < 300) {
                        string += `    ${key}: ${value.toString()}\n`;
                    } else {
                        string += `    ${key}: <${
                            value.toString().length
                        } bytes>\n`;
                    }
                }
            } else {
                const text = await req.text();
                string += `    ${text}\n`;
            }
        }
        await this.log(LogLevel.INFO, "Request", string);
    }
}

/**
 * Outputs to multiple LogManager instances at once
 */
export class MultiLogManager {
    constructor(private logManagers: LogManager[]) {}

    /**
     * Logs a message to all logManagers
     * @param level Importance of the log
     * @param entity Emitter of the log
     * @param message Message to log
     * @param showTimestamp Whether to show the timestamp in the log
     */
    async log(
        level: LogLevel,
        entity: string,
        message: string,
        showTimestamp = true,
    ) {
        for (const logManager of this.logManagers) {
            await logManager.log(level, entity, message, showTimestamp);
        }
    }

    /**
     * Logs an error to all logManagers
     * @param level Importance of the log
     * @param entity Emitter of the log
     * @param error Error to log
     */
    async logError(level: LogLevel, entity: string, error: Error) {
        for (const logManager of this.logManagers) {
            await logManager.logError(level, entity, error);
        }
    }

    /**
     * Logs a request to all logManagers
     * @param req Request to log
     * @param ip IP of the request
     * @param logAllDetails Whether to log all details of the request
     */
    async logRequest(req: Request, ip?: string, logAllDetails = false) {
        for (const logManager of this.logManagers) {
            await logManager.logRequest(req, ip, logAllDetails);
        }
    }

    /**
     * Create a MultiLogManager from multiple LogManager instances
     * @param logManagers LogManager instances to use
     * @returns
     */
    static fromLogManagers(...logManagers: LogManager[]) {
        return new MultiLogManager(logManagers);
    }
}
