import type { CliParameter } from "./cli-builder.type";
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
				// If this part doesn't exist in the current level of the tree, add it
				// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
				if (!currentLevel[part]) {
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
}

/**
 * A command that can be executed from the command line
 * @param categories Example: `["user", "create"]` for the command `./cli user create --name John`
 */
export class CliCommand {
	constructor(
		public categories: string[],
		public argTypes: CliParameter[],
		private execute: (args: Record<string, any>) => void,
		public description?: string,
		public example?: string
	) {}

	/**
	 * Display help message for the command
	 * formatted with Chalk and with emojis
	 */
	displayHelp() {
		const positionedArgs = this.argTypes.filter(arg => arg.positioned);
		const unpositionedArgs = this.argTypes.filter(arg => !arg.positioned);
		const helpMessage = `
${chalk.green("📚 Command:")} ${chalk.yellow(this.categories.join(" "))}
${this.description ? `${chalk.cyan(this.description)}\n` : ""}
${chalk.magenta("🔧 Arguments:")}
${unpositionedArgs
	.map(
		arg =>
			`${chalk.bold(arg.name)}: ${chalk.blue(arg.description ?? "(no description)")} ${
				arg.optional ? chalk.gray("(optional)") : ""
			}`
	)
	.join("\n")}
${positionedArgs
	.map(
		arg =>
			`--${chalk.bold(arg.name)}: ${chalk.blue(arg.description ?? "(no description)")} ${
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

const cliBuilder = new CliBuilder();

const cliCommand = new CliCommand(
	["category1", "category2"],
	[
		{
			name: "name",
			type: "string",
			needsValue: true,
			description: "Name of new item",
		},
		{
			name: "delete-previous",
			type: "number",
			needsValue: false,
			positioned: true,
			optional: true,
			description: "Also delete the previous item",
		},
		{ name: "arg3", type: "boolean", needsValue: false },
		{ name: "arg4", type: "array", needsValue: true },
	],
	() => {
		// Do nothing
	},
	"I love sussy sauces",
	"emoji add --url https://site.com/image.png"
);

cliBuilder.registerCommand(cliCommand);
//cliBuilder.displayHelp();
