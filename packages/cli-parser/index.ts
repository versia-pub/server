import type { CliParameter } from "./cli-builder.type";

export function startsWithArray(fullArray: any[], startArray: any[]) {
	if (startArray.length > fullArray.length) {
		return false;
	}
	return fullArray
		.slice(0, startArray.length)
		.every((value, index) => value === startArray[index]);
}

/**
 * Builder for a CLI
 * @param commands Array of commands to register
 */
export class CliBuilder {
	constructor(public commands: CliCommand[] = []) {}

	/**
	 * Add command to the CLI
	 * @throws Error if command already exists
	 * @param command Command to add
	 */
	registerCommand(command: CliCommand) {
		if (this.checkIfCommandAlreadyExists(command)) {
			throw new Error(
				`Command category '${command.categories.join(" ")}' already exists`
			);
		}
		this.commands.push(command);
	}

	/**
	 * Add multiple commands to the CLI
	 * @throws Error if command already exists
	 * @param commands Commands to add
	 */
	registerCommands(commands: CliCommand[]) {
		const existingCommand = commands.find(command =>
			this.checkIfCommandAlreadyExists(command)
		);
		if (existingCommand) {
			throw new Error(
				`Command category '${existingCommand.categories.join(" ")}' already exists`
			);
		}
		this.commands.push(...commands);
	}

	/**
	 * Remove command from the CLI
	 * @param command Command to remove
	 */
	deregisterCommand(command: CliCommand) {
		this.commands = this.commands.filter(
			registeredCommand => registeredCommand !== command
		);
	}

	/**
	 * Remove multiple commands from the CLI
	 * @param commands Commands to remove
	 */
	deregisterCommands(commands: CliCommand[]) {
		this.commands = this.commands.filter(
			registeredCommand => !commands.includes(registeredCommand)
		);
	}

	checkIfCommandAlreadyExists(command: CliCommand) {
		return this.commands.some(
			registeredCommand =>
				registeredCommand.categories.length ==
					command.categories.length &&
				registeredCommand.categories.every(
					(category, index) => category === command.categories[index]
				)
		);
	}

	/**
	 * Get relevant args for the command (without executable or runtime)
	 * @param args Arguments passed to the CLI
	 */
	private getRelevantArgs(args: string[]) {
		if (args[0].startsWith("./")) {
			// Formatted like ./cli.ts [command]
			return args.slice(1);
		} else if (args[0].includes("bun")) {
			// Formatted like bun cli.ts [command]
			return args.slice(2);
		} else {
			return args;
		}
	}

	/**
	 * Turn raw system args into a CLI command and run it
	 * @param args Args directly from process.argv
	 */
	processArgs(args: string[]) {
		const revelantArgs = this.getRelevantArgs(args);
		// Find revelant command
		// Search for a command with as many categories matching args as possible
		const matchingCommands = this.commands.filter(command =>
			startsWithArray(revelantArgs, command.categories)
		);

		// Get command with largest category size
		const command = matchingCommands.reduce((prev, current) =>
			prev.categories.length > current.categories.length ? prev : current
		);

		const argsWithoutCategories = args.slice(command.categories.length - 1);

		command.run(argsWithoutCategories);
	}
}

/**
 * A command that can be executed from the command line
 * @param categories Example: `["user", "create"]` for the command `./cli user create --name John`
 */
export class CliCommand {
	constructor(
		public categories: string[],
		public argTypes: CliParameter[],
		private execute: (args: Record<string, any>) => void
	) {}

	/**
	 * Parses string array arguments into a full JavaScript object
	 * @param argsWithoutCategories
	 * @returns
	 */
	private parseArgs(argsWithoutCategories: string[]): Record<string, any> {
		const parsedArgs: Record<string, any> = {};
		let currentParameter: CliParameter | null = null;

		for (let i = 0; i < argsWithoutCategories.length; i++) {
			const arg = argsWithoutCategories[i];

			if (arg.startsWith("--")) {
				const argName = arg.substring(2);
				currentParameter =
					this.argTypes.find(argType => argType.name === argName) ||
					null;
				if (currentParameter && !currentParameter.needsValue) {
					parsedArgs[argName] = true;
					currentParameter = null;
				} else if (currentParameter && currentParameter.needsValue) {
					parsedArgs[argName] = this.castArgValue(
						argsWithoutCategories[i + 1],
						currentParameter.type
					);
					i++;
					currentParameter = null;
				}
			} else if (currentParameter) {
				parsedArgs[currentParameter.name] = this.castArgValue(
					arg,
					currentParameter.type
				);
				currentParameter = null;
			} else {
				const positionedArgType = this.argTypes.find(
					argType => argType.positioned
				);
				if (positionedArgType) {
					parsedArgs[positionedArgType.name] = this.castArgValue(
						arg,
						positionedArgType.type
					);
				}
			}
		}

		return parsedArgs;
	}

	private castArgValue(value: string, type: CliParameter["type"]): any {
		switch (type) {
			case "string":
				return value;
			case "number":
				return Number(value);
			case "boolean":
				return value === "true";
			case "array":
				return value.split(",");
			default:
				return value;
		}
	}

	/**
	 * Runs the execute function with the parsed parameters as an argument
	 */
	run(argsWithoutCategories: string[]) {
		const args = this.parseArgs(argsWithoutCategories);
		this.execute(args);
	}
}
