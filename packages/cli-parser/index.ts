import { CliParameterType, type CliParameter } from "./cli-builder.type";
import chalk from "chalk";

export function startsWithArray(fullArray: any[], startArray: any[]) {
	if (startArray.length > fullArray.length) {
		return false;
	}
	return fullArray
		.slice(0, startArray.length)
		.every((value, index) => value === startArray[index]);
}

interface TreeType {
	[key: string]: CliCommand | TreeType;
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

	/**
	 * Recursively urns the commands into a tree where subcategories mark each sub-branch
	 * @example
	 * ```txt
	 * user verify
	 * user delete
	 * user new admin
	 * user new
	 * ->
	 * user
	 *   verify
	 *   delete
	 *   new
	 *     admin
	 *     ""
	 * ```
	 */
	getCommandTree(commands: CliCommand[]): TreeType {
		const tree: TreeType = {};

		for (const command of commands) {
			let currentLevel = tree; // Start at the root

			// Split the command into parts and iterate over them
			for (const part of command.categories) {
				// If this part doesn't exist in the current level of the tree, add it (__proto__ check to prevent prototype pollution)
				// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
				if (!currentLevel[part] && part !== "__proto__") {
					// If this is the last part of the command, add the command itself
					if (
						part ===
						command.categories[command.categories.length - 1]
					) {
						currentLevel[part] = command;
						break;
					}
					currentLevel[part] = {};
				}

				// Move down to the next level of the tree
				currentLevel = currentLevel[part] as TreeType;
			}
		}

		return tree;
	}

	/**
	 * Display help for every command in a tree manner
	 */
	displayHelp() {
		/*
		user
		  set
		    admin: List of admin commands
			  --prod: Whether to run in production
			  --dev: Whether to run in development
			  username: Username of the admin
			  Example: user set admin --prod --dev --username John
			delete
			  ...
		  verify
		    ...
		*/
		const tree = this.getCommandTree(this.commands);
		let writeBuffer = "";

		const displayTree = (tree: TreeType, depth = 0) => {
			for (const [key, value] of Object.entries(tree)) {
				if (value instanceof CliCommand) {
					writeBuffer += `${"    ".repeat(depth)}${chalk.blue(key)}|${chalk.underline(value.description)}\n`;
					const positionedArgs = value.argTypes.filter(
						arg => arg.positioned ?? true
					);
					const unpositionedArgs = value.argTypes.filter(
						arg => !(arg.positioned ?? true)
					);

					for (const arg of positionedArgs) {
						writeBuffer += `${"    ".repeat(depth + 1)}${chalk.green(
							arg.name
						)}|${
							arg.description ?? "(no description)"
						} ${arg.optional ? chalk.gray("(optional)") : ""}\n`;
					}
					for (const arg of unpositionedArgs) {
						writeBuffer += `${"    ".repeat(depth + 1)}${chalk.yellow("--" + arg.name)}${arg.shortName ? ", " + chalk.yellow("-" + arg.shortName) : ""}|${
							arg.description ?? "(no description)"
						} ${arg.optional ? chalk.gray("(optional)") : ""}\n`;
					}

					if (value.example) {
						writeBuffer += `${"    ".repeat(depth + 1)}${chalk.bold("Example:")} ${chalk.bgGray(
							value.example
						)}\n`;
					}
				} else {
					writeBuffer += `${"    ".repeat(depth)}${chalk.blue(key)}\n`;
					displayTree(value, depth + 1);
				}
			}
		};

		displayTree(tree);

		// Replace all "|" with enough dots so that the text on the left + the dots = the same length
		const optimal_length = Number(
			// @ts-expect-error Slightly hacky but works
			writeBuffer.split("\n").reduce((prev, current) => {
				// If previousValue is empty
				if (!prev)
					return current.includes("|")
						? current.split("|")[0].length
						: 0;
				if (!current.includes("|")) return prev;
				const [left] = current.split("|");
				return Math.max(Number(prev), left.length);
			})
		);

		for (const line of writeBuffer.split("\n")) {
			const [left, right] = line.split("|");
			if (!right) {
				console.log(left);
				continue;
			}
			const dots = ".".repeat(optimal_length + 5 - left.length);
			console.log(`${left}${dots}${right}`);
		}
	}
}

type ExecuteFunction<T> = (
	instance: CliCommand,
	args: Partial<T>
) => Promise<void> | void;

/**
 * A command that can be executed from the command line
 * @param categories Example: `["user", "create"]` for the command `./cli user create --name John`
 */
export class CliCommand<T = any> {
	constructor(
		public categories: string[],
		public argTypes: CliParameter[],
		private execute: ExecuteFunction<T>,
		public description?: string,
		public example?: string
	) {}

	/**
	 * Display help message for the command
	 * formatted with Chalk and with emojis
	 */
	displayHelp() {
		const positionedArgs = this.argTypes.filter(
			arg => arg.positioned ?? true
		);
		const unpositionedArgs = this.argTypes.filter(
			arg => !(arg.positioned ?? true)
		);
		const helpMessage = `
${chalk.green("📚 Command:")} ${chalk.yellow(this.categories.join(" "))}
${this.description ? `${chalk.cyan(this.description)}\n` : ""}
${chalk.magenta("🔧 Arguments:")}
${positionedArgs
	.map(
		arg =>
			`${chalk.bold(arg.name)}: ${chalk.blue(arg.description ?? "(no description)")} ${
				arg.optional ? chalk.gray("(optional)") : ""
			}`
	)
	.join("\n")}
${unpositionedArgs
	.map(
		arg =>
			`--${chalk.bold(arg.name)}${arg.shortName ? `, -${arg.shortName}` : ""}: ${chalk.blue(arg.description ?? "(no description)")} ${
				arg.optional ? chalk.gray("(optional)") : ""
			}`
	)
	.join(
		"\n"
	)}${this.example ? `\n${chalk.magenta("🚀 Example:")}\n${chalk.bgGray(this.example)}` : ""}
`;

		console.log(helpMessage);
	}

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
			} else if (arg.startsWith("-")) {
				const shortName = arg.substring(1);
				const argType = this.argTypes.find(
					argType => argType.shortName === shortName
				);
				if (argType && !argType.needsValue) {
					parsedArgs[argType.name] = true;
				} else if (argType && argType.needsValue) {
					parsedArgs[argType.name] = this.castArgValue(
						argsWithoutCategories[i + 1],
						argType.type
					);
					i++;
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
			case CliParameterType.STRING:
				return value;
			case CliParameterType.NUMBER:
				return Number(value);
			case CliParameterType.BOOLEAN:
				return value === "true";
			case CliParameterType.ARRAY:
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
		void this.execute(this, args as any);
	}
}
