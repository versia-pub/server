import type { BunFile } from "bun";
import { appendFile } from "fs/promises";

export enum LogLevel {
	DEBUG = "debug",
	INFO = "info",
	WARNING = "warning",
	ERROR = "error",
	CRITICAL = "critical",
}

/**
 * Class for handling logging to disk or to stdout
 * @param output BunFile of output (can be a normal file or something like Bun.stdout)
 */
export class LogManager {
	constructor(private output: BunFile) {
		void this.write(
			`--- INIT LogManager at ${new Date().toISOString()} --`
		);
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
		showTimestamp = true
	) {
		await this.write(
			`${showTimestamp ? new Date().toISOString() + " " : ""}[${level.toUpperCase()}] ${entity}: ${message}`
		);
	}

	private async write(text: string) {
		if (this.output == Bun.stdout) {
			await Bun.write(Bun.stdout, text + "\n");
		} else {
			if (!this.output.name) {
				throw new Error(`Output file doesnt exist (and isnt stdout)`);
			}
			await appendFile(this.output.name, text + "\n");
		}
	}

	/**
	 * Logs an error to the output, wrapper for log
	 * @param level Importance of the log
	 * @param entity Emitter of the log
	 * @param error Error to log
	 */
	async logError(level: LogLevel, entity: string, error: Error) {
		await this.log(level, entity, error.message);
	}
}
