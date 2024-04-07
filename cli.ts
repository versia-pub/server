import chalk from "chalk";
import { createNewLocalUser } from "~database/entities/User";
import Table from "cli-table";
import { rebuildSearchIndexes, MeiliIndexType } from "@meilisearch";
import { getUrl } from "~database/entities/Attachment";
import extract from "extract-zip";
import { client } from "~database/datasource";
import { CliBuilder, CliCommand } from "cli-parser";
import { CliParameterType } from "~packages/cli-parser/cli-builder.type";
import { config } from "~packages/config-manager";
import { Parser } from "@json2csv/plainjs";
import type { Prisma } from "@prisma/client";
import { MediaBackend } from "media-manager";
import { mkdtemp } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const args = process.argv;

const filterObjects = <T extends object>(output: T[], fields: string[]) => {
	if (fields.length === 0) return output;

	return output.map(element => {
		// If fields is specified, only include provided fields
		// This is a bit of a mess
		if (fields.length > 0) {
			const keys = Object.keys(element);
			const filteredKeys = keys.filter(key => fields.includes(key));
			return Object.entries(element)
				.filter(([key]) => filteredKeys.includes(key))
				.reduce((acc, [key, value]) => {
					// @ts-expect-error This is fine
					acc[key] = value;
					return acc;
				}, {}) as Partial<T>;
		} else {
			return element;
		}
	});
};

const cliBuilder = new CliBuilder([
	new CliCommand<{
		username: string;
		password: string;
		email: string;
		admin: boolean;
		help: boolean;
	}>(
		["user", "create"],
		[
			{
				name: "username",
				type: CliParameterType.STRING,
				description: "Username of the user",
				needsValue: true,
				positioned: false,
			},
			{
				name: "password",
				type: CliParameterType.STRING,
				description: "Password of the user",
				needsValue: true,
				positioned: false,
			},
			{
				name: "email",
				type: CliParameterType.STRING,
				description: "Email of the user",
				needsValue: true,
				positioned: false,
			},
			{
				name: "admin",
				type: CliParameterType.BOOLEAN,
				description: "Make the user an admin",
				needsValue: false,
				positioned: false,
			},
			{
				name: "help",
				shortName: "h",
				type: CliParameterType.EMPTY,
				description: "Show help message",
				needsValue: false,
				positioned: false,
			},
		],
		async (instance: CliCommand, args) => {
			const { username, password, email, admin, help } = args;

			if (help) {
				instance.displayHelp();
				return 0;
			}

			// Check if username, password and email are provided
			if (!username || !password || !email) {
				console.log(
					`${chalk.red(`✗`)} Missing username, password or email`
				);
				return 1;
			}

			// Check if user already exists
			const user = await client.user.findFirst({
				where: {
					OR: [{ username }, { email }],
				},
			});

			if (user) {
				if (user.username === username) {
					console.log(
						`${chalk.red(`✗`)} User with username ${chalk.blue(username)} already exists`
					);
				} else {
					console.log(
						`${chalk.red(`✗`)} User with email ${chalk.blue(email)} already exists`
					);
				}
				return 1;
			}

			// Create user
			const newUser = await createNewLocalUser({
				email: email,
				password: password,
				username: username,
				admin: admin,
			});

			console.log(
				`${chalk.green(`✓`)} Created user ${chalk.blue(
					newUser.username
				)}${admin ? chalk.green(" (admin)") : ""}`
			);

			return 0;
		},
		"Creates a new user",
		"bun cli user create --username admin --password password123 --email email@email.com"
	),
	new CliCommand<{
		username: string;
		help: boolean;
		noconfirm: boolean;
	}>(
		["user", "delete"],
		[
			{
				name: "username",
				type: CliParameterType.STRING,
				description: "Username of the user",
				needsValue: true,
				positioned: true,
			},
			{
				name: "help",
				shortName: "h",
				type: CliParameterType.EMPTY,
				description: "Show help message",
				needsValue: false,
				positioned: false,
			},
			{
				name: "noconfirm",
				shortName: "y",
				type: CliParameterType.EMPTY,
				description: "Skip confirmation",
				needsValue: false,
				positioned: false,
			},
		],
		async (instance: CliCommand, args) => {
			const { username, help } = args;

			if (help) {
				instance.displayHelp();
				return 0;
			}

			if (!username) {
				console.log(`${chalk.red(`✗`)} Missing username`);
				return 1;
			}

			const user = await client.user.findFirst({
				where: {
					username: username,
				},
			});

			if (!user) {
				console.log(`${chalk.red(`✗`)} User not found`);
				return 1;
			}

			if (!args.noconfirm) {
				process.stdout.write(
					`Are you sure you want to delete user ${chalk.blue(
						user.username
					)}?\n${chalk.red(chalk.bold("This is a destructive action and cannot be undone!"))} [y/N] `
				);

				for await (const line of console) {
					if (line.trim().toLowerCase() === "y") {
						break;
					} else {
						console.log(`${chalk.red(`✗`)} Deletion cancelled`);
						return 0;
					}
				}
			}

			await client.user.delete({
				where: {
					id: user.id,
				},
			});

			console.log(
				`${chalk.green(`✓`)} Deleted user ${chalk.blue(user.username)}`
			);

			return 0;
		},
		"Deletes a user",
		"bun cli user delete --username admin"
	),
	new CliCommand<{
		admins: boolean;
		help: boolean;
		format: string;
		limit: number;
		redact: boolean;
		fields: string[];
	}>(
		["user", "list"],
		[
			{
				name: "admins",
				type: CliParameterType.BOOLEAN,
				description: "List only admins",
				needsValue: false,
				positioned: false,
			},
			{
				name: "help",
				shortName: "h",
				type: CliParameterType.EMPTY,
				description: "Show help message",
				needsValue: false,
				positioned: false,
			},
			{
				name: "format",
				type: CliParameterType.STRING,
				description: "Output format (can be json or csv)",
				needsValue: true,
				positioned: false,
				optional: true,
			},
			{
				name: "limit",
				type: CliParameterType.NUMBER,
				description:
					"Limit the number of users to list (defaults to 200)",
				needsValue: true,
				positioned: false,
				optional: true,
			},
			{
				name: "redact",
				type: CliParameterType.BOOLEAN,
				description:
					"Redact sensitive information (such as password hashes, emails or keys)",
				needsValue: false,
				positioned: false,
				optional: true,
			},
			{
				name: "fields",
				type: CliParameterType.ARRAY,
				description:
					"If provided, restricts output to these fields (comma-separated)",
				needsValue: true,
				positioned: false,
				optional: true,
			},
		],
		async (instance: CliCommand, args) => {
			const { admins, help, fields = [] } = args;

			if (help) {
				instance.displayHelp();
				return 0;
			}

			if (args.format && !["json", "csv"].includes(args.format)) {
				console.log(`${chalk.red(`✗`)} Invalid format`);
				return 1;
			}
			const users = filterObjects(
				await client.user.findMany({
					where: {
						isAdmin: admins || undefined,
					},
					take: args.limit ?? 200,
					include: {
						instance:
							fields.length == 0
								? true
								: fields.includes("instance"),
					},
				}),
				fields
			);

			if (args.redact) {
				for (const user of users) {
					user.email = "[REDACTED]";
					user.password = "[REDACTED]";
					user.publicKey = "[REDACTED]";
					user.privateKey = "[REDACTED]";
				}
			}

			if (args.format === "json") {
				console.log(JSON.stringify(users, null, 4));
				return 0;
			} else if (args.format == "csv") {
				const parser = new Parser({});
				console.log(parser.parse(users));
				return 0;
			}

			console.log(
				`${chalk.green(`✓`)} Found ${chalk.blue(users.length)} users (limit ${args.limit ?? 200})`
			);

			const tableHead = filterObjects(
				[
					{
						username: chalk.white(chalk.bold("Username")),
						email: chalk.white(chalk.bold("Email")),
						displayName: chalk.white(chalk.bold("Display Name")),
						isAdmin: chalk.white(chalk.bold("Admin?")),
						instance: chalk.white(chalk.bold("Instance URL")),
						createdAt: chalk.white(chalk.bold("Created At")),
						id: chalk.white(chalk.bold("Internal UUID")),
					},
				],
				fields
			)[0];

			const table = new Table({
				head: Object.values(tableHead),
			});

			for (const user of users) {
				// Print table of users
				const data = {
					username: () => chalk.yellow(`@${user.username}`),
					email: () => chalk.green(user.email),
					displayName: () => chalk.blue(user.displayName),
					isAdmin: () => chalk.red(user.isAdmin ? "Yes" : "No"),
					instance: () =>
						chalk.blue(
							user.instance ? user.instance.base_url : "Local"
						),
					createdAt: () => chalk.blue(user.createdAt?.toISOString()),
					id: () => chalk.blue(user.id),
				};

				// Only keep the fields specified if --fields is provided
				if (args.fields) {
					const keys = Object.keys(data);
					for (const key of keys) {
						if (!args.fields.includes(key)) {
							// @ts-expect-error This is fine
							// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
							delete data[key];
						}
					}
				}

				table.push(Object.values(data).map(fn => fn()));
			}

			console.log(table.toString());

			return 0;
		},
		"Lists all users",
		"bun cli user list"
	),
	new CliCommand<{
		query: string;
		fields: string[];
		format: string;
		help: boolean;
		"case-sensitive": boolean;
		limit: number;
		redact: boolean;
	}>(
		["user", "search"],
		[
			{
				name: "query",
				type: CliParameterType.STRING,
				description: "Query to search for",
				needsValue: true,
				positioned: true,
			},
			{
				name: "fields",
				type: CliParameterType.ARRAY,
				description: "Fields to search in",
				needsValue: true,
				positioned: false,
			},
			{
				name: "format",
				type: CliParameterType.STRING,
				description: "Output format (can be json or csv)",
				needsValue: true,
				positioned: false,
				optional: true,
			},
			{
				name: "help",
				shortName: "h",
				type: CliParameterType.EMPTY,
				description: "Show help message",
				needsValue: false,
				positioned: false,
			},
			{
				name: "case-sensitive",
				shortName: "c",
				type: CliParameterType.EMPTY,
				description: "Case-sensitive search",
				needsValue: false,
				positioned: false,
				optional: true,
			},
			{
				name: "limit",
				type: CliParameterType.NUMBER,
				description: "Limit the number of users to list (default 20)",
				needsValue: true,
				positioned: false,
				optional: true,
			},
			{
				name: "redact",
				type: CliParameterType.BOOLEAN,
				description:
					"Redact sensitive information (such as password hashes, emails or keys)",
				needsValue: false,
				positioned: false,
				optional: true,
			},
		],
		async (instance: CliCommand, args) => {
			const {
				query,
				fields = [],
				help,
				limit = 20,
				"case-sensitive": caseSensitive = false,
				redact,
			} = args;

			if (help) {
				instance.displayHelp();
				return 0;
			}

			if (!query) {
				console.log(`${chalk.red(`✗`)} Missing query parameter`);
				return 1;
			}

			if (fields.length === 0) {
				console.log(`${chalk.red(`✗`)} Missing fields parameter`);
				return 1;
			}

			const queries: Prisma.UserWhereInput[] = [];

			for (const field of fields) {
				queries.push({
					[field]: {
						contains: query,
						mode: caseSensitive ? "default" : "insensitive",
					},
				});
			}

			const users = await client.user.findMany({
				where: {
					OR: queries,
				},
				include: {
					instance: true,
				},
				take: limit,
			});

			if (redact) {
				for (const user of users) {
					user.email = "[REDACTED]";
					user.password = "[REDACTED]";
					user.publicKey = "[REDACTED]";
					user.privateKey = "[REDACTED]";
				}
			}

			if (args.format === "json") {
				console.log(JSON.stringify(users, null, 4));
				return 0;
			} else if (args.format === "csv") {
				const parser = new Parser({});
				console.log(parser.parse(users));
				return 0;
			}

			console.log(
				`${chalk.green(`✓`)} Found ${chalk.blue(users.length)} users (limit ${limit})`
			);

			const table = new Table({
				head: [
					chalk.white(chalk.bold("Username")),
					chalk.white(chalk.bold("Email")),
					chalk.white(chalk.bold("Display Name")),
					chalk.white(chalk.bold("Admin?")),
					chalk.white(chalk.bold("Instance URL")),
				],
			});

			for (const user of users) {
				table.push([
					chalk.yellow(`@${user.username}`),
					chalk.green(user.email),
					chalk.blue(user.displayName),
					chalk.red(user.isAdmin ? "Yes" : "No"),
					chalk.blue(
						user.instanceId ? user.instance?.base_url : "Local"
					),
				]);
			}

			console.log(table.toString());

			return 0;
		},
		"Searches for a user",
		"bun cli user search bob --fields email,username"
	),

	new CliCommand<{
		username: string;
		"issuer-id": string;
		"server-id": string;
		help: boolean;
	}>(
		["user", "oidc", "connect"],
		[
			{
				name: "username",
				type: CliParameterType.STRING,
				description: "Username of the local account",
				needsValue: true,
				positioned: true,
			},
			{
				name: "issuer-id",
				type: CliParameterType.STRING,
				description: "ID of the OpenID Connect issuer in config",
				needsValue: true,
				positioned: false,
			},
			{
				name: "server-id",
				type: CliParameterType.STRING,
				description: "ID of the user on the OpenID Connect server",
				needsValue: true,
				positioned: false,
			},
			{
				name: "help",
				shortName: "h",
				type: CliParameterType.EMPTY,
				description: "Show help message",
				needsValue: false,
				positioned: false,
			},
		],
		async (instance: CliCommand, args) => {
			const {
				username,
				"issuer-id": issuerId,
				"server-id": serverId,
				help,
			} = args;

			if (help) {
				instance.displayHelp();
				return 0;
			}

			if (!username || !issuerId || !serverId) {
				console.log(`${chalk.red(`✗`)} Missing username, issuer or ID`);
				return 1;
			}

			// Check if issuerId is valid
			if (!config.oidc.providers.find(p => p.id === issuerId)) {
				console.log(`${chalk.red(`✗`)} Invalid issuer ID`);
				return 1;
			}

			const user = await client.user.findFirst({
				where: {
					username: username,
				},
				include: {
					linkedOpenIdAccounts: true,
				},
			});

			if (!user) {
				console.log(`${chalk.red(`✗`)} User not found`);
				return 1;
			}

			if (user.linkedOpenIdAccounts.find(a => a.issuerId === issuerId)) {
				console.log(
					`${chalk.red(`✗`)} User ${chalk.blue(
						user.username
					)} is already connected to this OpenID Connect issuer with another account`
				);
				return 1;
			}

			// Connect the OpenID account
			await client.user.update({
				where: {
					id: user.id,
				},
				data: {
					linkedOpenIdAccounts: {
						create: {
							issuerId: issuerId,
							serverId: serverId,
						},
					},
				},
			});

			console.log(
				`${chalk.green(`✓`)} Connected OpenID Connect account to user ${chalk.blue(
					user.username
				)}`
			);

			return 0;
		},
		"Connects an OpenID Connect account to a local account",
		"bun cli user oidc connect admin google 123456789"
	),
	new CliCommand<{
		"server-id": string;
		help: boolean;
	}>(
		["user", "oidc", "disconnect"],
		[
			{
				name: "server-id",
				type: CliParameterType.STRING,
				description: "Server ID of the OpenID Connect account",
				needsValue: true,
				positioned: true,
			},
			{
				name: "help",
				shortName: "h",
				type: CliParameterType.EMPTY,
				description: "Show help message",
				needsValue: false,
				positioned: false,
			},
		],
		async (instance: CliCommand, args) => {
			const { "server-id": id, help } = args;

			if (help) {
				instance.displayHelp();
				return 0;
			}

			if (!id) {
				console.log(`${chalk.red(`✗`)} Missing ID`);
				return 1;
			}

			const account = await client.openIdAccount.findFirst({
				where: {
					serverId: id,
				},
				include: {
					User: true,
				},
			});

			if (!account) {
				console.log(`${chalk.red(`✗`)} Account not found`);
				return 1;
			}

			await client.openIdAccount.delete({
				where: {
					id: account.id,
				},
			});

			console.log(
				`${chalk.green(`✓`)} Disconnected OpenID account from user ${chalk.blue(account.User?.username)}`
			);

			return 0;
		},
		"Disconnects an OpenID Connect account from a local account",
		"bun cli user oidc disconnect 123456789"
	),
	new CliCommand<{
		id: string;
		help: boolean;
		noconfirm: boolean;
	}>(
		["note", "delete"],
		[
			{
				name: "id",
				type: CliParameterType.STRING,
				description: "ID of the note",
				needsValue: true,
				positioned: true,
			},
			{
				name: "help",
				shortName: "h",
				type: CliParameterType.EMPTY,
				description: "Show help message",
				needsValue: false,
				positioned: false,
			},
			{
				name: "noconfirm",
				shortName: "y",
				type: CliParameterType.EMPTY,
				description: "Skip confirmation",
				needsValue: false,
				positioned: false,
			},
		],
		async (instance: CliCommand, args) => {
			const { id, help } = args;

			if (help) {
				instance.displayHelp();
				return 0;
			}

			if (!id) {
				console.log(`${chalk.red(`✗`)} Missing ID`);
				return 1;
			}

			const note = await client.status.findFirst({
				where: {
					id: id,
				},
			});

			if (!note) {
				console.log(`${chalk.red(`✗`)} Note not found`);
				return 1;
			}

			if (!args.noconfirm) {
				process.stdout.write(
					`Are you sure you want to delete note ${chalk.blue(
						note.id
					)}?\n${chalk.red(chalk.bold("This is a destructive action and cannot be undone!"))} [y/N] `
				);

				for await (const line of console) {
					if (line.trim().toLowerCase() === "y") {
						break;
					} else {
						console.log(`${chalk.red(`✗`)} Deletion cancelled`);
						return 0;
					}
				}
			}

			await client.status.delete({
				where: {
					id: note.id,
				},
			});

			console.log(
				`${chalk.green(`✓`)} Deleted note ${chalk.blue(note.id)}`
			);

			return 0;
		},
		"Deletes a note",
		"bun cli note delete 018c1838-6e0b-73c4-a157-a91ea4e25d1d"
	),
	new CliCommand<{
		query: string;
		fields: string[];
		local: boolean;
		remote: boolean;
		format: string;
		help: boolean;
		"case-sensitive": boolean;
		limit: number;
		redact: boolean;
	}>(
		["note", "search"],
		[
			{
				name: "query",
				type: CliParameterType.STRING,
				description: "Query to search for",
				needsValue: true,
				positioned: true,
			},
			{
				name: "fields",
				type: CliParameterType.ARRAY,
				description: "Fields to search in",
				needsValue: true,
				positioned: false,
			},
			{
				name: "local",
				type: CliParameterType.BOOLEAN,
				description: "Only search in local statuses",
				needsValue: false,
				positioned: false,
				optional: true,
			},
			{
				name: "remote",
				type: CliParameterType.BOOLEAN,
				description: "Only search in remote statuses",
				needsValue: false,
				positioned: false,
				optional: true,
			},
			{
				name: "format",
				type: CliParameterType.STRING,
				description: "Output format (can be json or csv)",
				needsValue: true,
				positioned: false,
				optional: true,
			},
			{
				name: "help",
				shortName: "h",
				type: CliParameterType.EMPTY,
				description: "Show help message",
				needsValue: false,
				positioned: false,
			},
			{
				name: "case-sensitive",
				shortName: "c",
				type: CliParameterType.EMPTY,
				description: "Case-sensitive search",
				needsValue: false,
				positioned: false,
				optional: true,
			},
			{
				name: "limit",
				type: CliParameterType.NUMBER,
				description: "Limit the number of notes to list (default 20)",
				needsValue: true,
				positioned: false,
				optional: true,
			},
			{
				name: "redact",
				type: CliParameterType.BOOLEAN,
				description:
					"Redact sensitive information (such as password hashes, emails or keys)",
				needsValue: false,
				positioned: false,
				optional: true,
			},
		],
		async (instance: CliCommand, args) => {
			const {
				query,
				local,
				remote,
				format,
				help,
				limit = 20,
				fields = [],
				"case-sensitive": caseSensitive = false,
				redact,
			} = args;

			if (help) {
				instance.displayHelp();
				return 0;
			}

			if (!query) {
				console.log(`${chalk.red(`✗`)} Missing query parameter`);
				return 1;
			}

			if (fields.length === 0) {
				console.log(`${chalk.red(`✗`)} Missing fields parameter`);
				return 1;
			}

			const queries: Prisma.StatusWhereInput[] = [];

			for (const field of fields) {
				queries.push({
					[field]: {
						contains: query,
						mode: caseSensitive ? "default" : "insensitive",
					},
				});
			}

			let instanceIdQuery;

			if (local && remote) {
				instanceIdQuery = undefined;
			} else if (local) {
				instanceIdQuery = null;
			} else if (remote) {
				instanceIdQuery = {
					not: null,
				};
			} else {
				instanceIdQuery = undefined;
			}

			const notes = await client.status.findMany({
				where: {
					OR: queries,
					instanceId: instanceIdQuery,
				},
				include: {
					author: true,
					instance: true,
				},
				take: limit,
			});

			if (redact) {
				for (const note of notes) {
					note.author.email = "[REDACTED]";
					note.author.password = "[REDACTED]";
					note.author.publicKey = "[REDACTED]";
					note.author.privateKey = "[REDACTED]";
				}
			}

			if (format === "json") {
				console.log(JSON.stringify(notes, null, 4));
				return 0;
			} else if (format === "csv") {
				const parser = new Parser({});
				console.log(parser.parse(notes));
				return 0;
			}

			console.log(
				`${chalk.green(`✓`)} Found ${chalk.blue(notes.length)} notes (limit ${limit})`
			);

			const table = new Table({
				head: [
					chalk.white(chalk.bold("ID")),
					chalk.white(chalk.bold("Content")),
					chalk.white(chalk.bold("Author")),
					chalk.white(chalk.bold("Instance")),
					chalk.white(chalk.bold("Created At")),
				],
			});

			for (const note of notes) {
				table.push([
					chalk.yellow(note.id),
					chalk.green(note.content),
					chalk.blue(note.author.username),
					chalk.red(
						note.instanceId ? note.instance?.base_url : "Yes"
					),
					chalk.blue(note.createdAt.toISOString()),
				]);
			}

			console.log(table.toString());

			return 0;
		},
		"Searches for a status",
		"bun cli note search hello --fields content --local"
	),
	new CliCommand<{
		help: boolean;
		type: string[];
	}>(
		["index", "rebuild"],
		[
			{
				name: "help",
				shortName: "h",
				type: CliParameterType.EMPTY,
				description: "Show help message",
				needsValue: false,
				positioned: false,
			},
			{
				name: "type",
				type: CliParameterType.ARRAY,
				description:
					"Type(s) of index(es) to rebuild (can be accounts or statuses)",
				needsValue: true,
				positioned: false,
				optional: true,
			},
		],
		async (instance: CliCommand, args) => {
			const { help, type = [] } = args;

			if (help) {
				instance.displayHelp();
				return 0;
			}

			// Check if Meilisearch is enabled
			if (!config.meilisearch.enabled) {
				console.log(`${chalk.red(`✗`)} Meilisearch is not enabled`);
				return 1;
			}

			// Check type validity
			for (const _type of type) {
				if (
					!Object.values(MeiliIndexType).includes(
						_type as MeiliIndexType
					)
				) {
					console.log(
						`${chalk.red(`✗`)} Invalid index type ${chalk.blue(_type)}`
					);
					return 1;
				}
			}

			if (type.length === 0) {
				// Rebuild all indexes
				await rebuildSearchIndexes(Object.values(MeiliIndexType));
			} else {
				await rebuildSearchIndexes(type as MeiliIndexType[]);
			}

			console.log(`${chalk.green(`✓`)} Rebuilt search indexes`);

			return 0;
		},
		"Rebuilds the Meilisearch indexes",
		"bun cli index rebuild"
	),
	new CliCommand<{
		help: boolean;
		shortcode: string;
		url: string;
		"keep-url": boolean;
	}>(
		["emoji", "add"],
		[
			{
				name: "help",
				shortName: "h",
				type: CliParameterType.EMPTY,
				description: "Show help message",
				needsValue: false,
				positioned: false,
				optional: true,
			},
			{
				name: "shortcode",
				type: CliParameterType.STRING,
				description: "Shortcode of the new emoji",
				needsValue: true,
				positioned: true,
			},
			{
				name: "url",
				type: CliParameterType.STRING,
				description: "URL of the new emoji",
				needsValue: true,
				positioned: true,
			},
			{
				name: "keep-url",
				type: CliParameterType.BOOLEAN,
				description:
					"Keep the URL of the emoji instead of uploading the file to object storage",
				needsValue: false,
				positioned: false,
			},
		],
		async (instance: CliCommand, args) => {
			const { help, shortcode, url } = args;

			if (help) {
				instance.displayHelp();
				return 0;
			}

			if (!shortcode) {
				console.log(`${chalk.red(`✗`)} Missing shortcode`);
				return 1;
			}
			if (!url) {
				console.log(`${chalk.red(`✗`)} Missing URL`);
				return 1;
			}

			// Check if shortcode is valid
			if (!shortcode.match(/^[a-zA-Z0-9-_]+$/)) {
				console.log(
					`${chalk.red(`✗`)} Invalid shortcode (must be alphanumeric with dashes and underscores allowed)`
				);
				return 1;
			}

			// Check if URL is valid
			if (!URL.canParse(url)) {
				console.log(
					`${chalk.red(`✗`)} Invalid URL (must be a valid full URL, including protocol)`
				);
				return 1;
			}

			// Check if emoji already exists
			const existingEmoji = await client.emoji.findFirst({
				where: {
					shortcode: shortcode,
					instanceId: null,
				},
			});

			if (existingEmoji) {
				console.log(
					`${chalk.red(`✗`)} Emoji with shortcode ${chalk.blue(
						shortcode
					)} already exists`
				);
				return 1;
			}

			let newUrl = url;

			if (!args["keep-url"]) {
				// Upload the emoji to object storage
				const mediaBackend = await MediaBackend.fromBackendType(
					config.media.backend,
					config
				);

				console.log(
					`${chalk.blue(`⏳`)} Downloading emoji from ${chalk.underline(chalk.blue(url))}`
				);

				const downloadedFile = await fetch(url).then(
					async r =>
						new File(
							[await r.blob()],
							url.split("/").pop() ??
								`${crypto.randomUUID()}-emoji.png`
						)
				);

				const metadata = await mediaBackend
					.addFile(downloadedFile)
					.catch(() => null);

				if (!metadata) {
					console.log(
						`${chalk.red(`✗`)} Failed to upload emoji to object storage (is your URL accessible?)`
					);
					return 1;
				}

				newUrl = getUrl(metadata.uploadedFile.name, config);

				console.log(
					`${chalk.green(`✓`)} Uploaded emoji to object storage`
				);
			}

			// Add the emoji
			const content_type = `image/${url
				.split(".")
				.pop()
				?.replace("jpg", "jpeg")}}`;

			const emoji = await client.emoji.create({
				data: {
					shortcode: shortcode,
					url: newUrl,
					visible_in_picker: true,
					content_type: content_type,
					instanceId: null,
				},
			});

			console.log(
				`${chalk.green(`✓`)} Created emoji ${chalk.blue(
					emoji.shortcode
				)}`
			);

			return 0;
		},
		"Adds a custom emoji",
		"bun cli emoji add bun https://bun.com/bun.png"
	),
	new CliCommand<{
		help: boolean;
		shortcode: string;
		noconfirm: boolean;
	}>(
		["emoji", "delete"],
		[
			{
				name: "help",
				shortName: "h",
				type: CliParameterType.EMPTY,
				description: "Show help message",
				needsValue: false,
				positioned: false,
				optional: true,
			},
			{
				name: "shortcode",
				type: CliParameterType.STRING,
				description:
					"Shortcode of the emoji to delete (can add up to two wildcards *)",
				needsValue: true,
				positioned: true,
			},
			{
				name: "noconfirm",
				type: CliParameterType.BOOLEAN,
				description: "Skip confirmation",
				needsValue: false,
				positioned: false,
				optional: true,
			},
		],
		async (instance: CliCommand, args) => {
			const { help, shortcode, noconfirm } = args;

			if (help) {
				instance.displayHelp();
				return 0;
			}

			if (!shortcode) {
				console.log(`${chalk.red(`✗`)} Missing shortcode`);
				return 1;
			}

			// Check if shortcode is valid
			if (!shortcode.match(/^[a-zA-Z0-9-_*]+$/)) {
				console.log(
					`${chalk.red(`✗`)} Invalid shortcode (must be alphanumeric with dashes and underscores allowed + optional wildcards)`
				);
				return 1;
			}

			// Validate up to one wildcard
			if (shortcode.split("*").length > 3) {
				console.log(
					`${chalk.red(`✗`)} Invalid shortcode (can only have up to two wildcards)`
				);
				return 1;
			}

			const hasWildcard = shortcode.includes("*");
			const hasTwoWildcards = shortcode.split("*").length === 3;

			const emojis = await client.emoji.findMany({
				where: {
					shortcode: {
						startsWith: hasWildcard
							? shortcode.split("*")[0]
							: undefined,
						endsWith: hasWildcard
							? shortcode.split("*").at(-1)
							: undefined,
						contains: hasTwoWildcards
							? shortcode.split("*")[1]
							: undefined,
						equals: hasWildcard ? undefined : shortcode,
					},
					instanceId: null,
				},
			});

			if (emojis.length === 0) {
				console.log(
					`${chalk.red(`✗`)} No emoji with shortcode ${chalk.blue(
						shortcode
					)} found`
				);
				return 1;
			}

			// List emojis and ask for confirmation
			for (const emoji of emojis) {
				console.log(
					`${chalk.blue(emoji.shortcode)}: ${chalk.underline(
						emoji.url
					)}`
				);
			}

			if (!noconfirm) {
				process.stdout.write(
					`Are you sure you want to delete these emojis?\n${chalk.red(chalk.bold("This is a destructive action and cannot be undone!"))} [y/N] `
				);

				for await (const line of console) {
					if (line.trim().toLowerCase() === "y") {
						break;
					} else {
						console.log(`${chalk.red(`✗`)} Deletion cancelled`);
						return 0;
					}
				}
			}

			await client.emoji.deleteMany({
				where: {
					id: {
						in: emojis.map(e => e.id),
					},
				},
			});

			console.log(
				`${chalk.green(`✓`)} Deleted emojis matching shortcode ${chalk.blue(
					shortcode
				)}`
			);

			return 0;
		},
		"Deletes custom emojis",
		"bun cli emoji delete bun"
	),
	new CliCommand<{
		help: boolean;
		format: string;
		limit: number;
	}>(
		["emoji", "list"],
		[
			{
				name: "help",
				shortName: "h",
				type: CliParameterType.EMPTY,
				description: "Show help message",
				needsValue: false,
				positioned: false,
				optional: true,
			},
			{
				name: "format",
				type: CliParameterType.STRING,
				description: "Output format (can be json or csv)",
				needsValue: true,
				positioned: false,
				optional: true,
			},
			{
				name: "limit",
				type: CliParameterType.NUMBER,
				description: "Limit the number of emojis to list (default 20)",
				needsValue: true,
				positioned: false,
				optional: true,
			},
		],
		async (instance: CliCommand, args) => {
			const { help, format, limit = 20 } = args;

			if (help) {
				instance.displayHelp();
				return 0;
			}

			const emojis = await client.emoji.findMany({
				where: {
					instanceId: null,
				},
				take: limit,
			});

			if (format === "json") {
				console.log(JSON.stringify(emojis, null, 4));
				return 0;
			} else if (format === "csv") {
				const parser = new Parser({});
				console.log(parser.parse(emojis));
				return 0;
			}

			console.log(
				`${chalk.green(`✓`)} Found ${chalk.blue(emojis.length)} emojis (limit ${limit})`
			);

			const table = new Table({
				head: [
					chalk.white(chalk.bold("Shortcode")),
					chalk.white(chalk.bold("URL")),
				],
			});

			for (const emoji of emojis) {
				table.push([
					chalk.blue(emoji.shortcode),
					chalk.underline(emoji.url),
				]);
			}

			console.log(table.toString());

			return 0;
		},
		"Lists all custom emojis",
		"bun cli emoji list"
	),
	new CliCommand<{
		help: boolean;
		url: string;
		noconfirm: boolean;
	}>(
		["emoji", "import"],
		[
			{
				name: "help",
				shortName: "h",
				type: CliParameterType.EMPTY,
				description: "Show help message",
				needsValue: false,
				positioned: false,
				optional: true,
			},
			{
				name: "url",
				type: CliParameterType.STRING,
				description: "URL of the emoji pack manifest",
				needsValue: true,
				positioned: true,
			},
			{
				name: "noconfirm",
				type: CliParameterType.BOOLEAN,
				description: "Skip confirmation",
				needsValue: false,
				positioned: false,
				optional: true,
			},
		],
		async (instance: CliCommand, args) => {
			const { help, url, noconfirm } = args;

			if (help) {
				instance.displayHelp();
				return 0;
			}

			if (!url) {
				console.log(`${chalk.red(`✗`)} Missing URL`);
				return 1;
			}

			// Check if URL is valid
			if (!URL.canParse(url)) {
				console.log(
					`${chalk.red(`✗`)} Invalid URL (must be a valid full URL, including protocol)`
				);
				return 1;
			}

			// Fetch the emoji pack manifest
			const manifest = await fetch(url)
				.then(
					r =>
						r.json() as Promise<
							Record<
								string,
								{
									files: string;
									homepage: string;
									src: string;
									src_sha256?: string;
								}
							>
						>
				)
				.catch(() => null);

			if (!manifest) {
				console.log(
					`${chalk.red(`✗`)} Failed to fetch emoji pack manifest from ${chalk.underline(
						url
					)}`
				);
				return 1;
			}

			const homepage = Object.values(manifest)[0].homepage;
			// If URL is not a valid URL, assume it's a relative path to homepage
			const srcUrl = URL.canParse(Object.values(manifest)[0].src)
				? Object.values(manifest)[0].src
				: new URL(Object.values(manifest)[0].src, homepage).toString();
			const filesUrl = URL.canParse(Object.values(manifest)[0].files)
				? Object.values(manifest)[0].files
				: new URL(
						Object.values(manifest)[0].files,
						homepage
					).toString();

			console.log(
				`${chalk.blue(`⏳`)} Fetching emoji pack from ${chalk.underline(
					srcUrl
				)}`
			);

			// Fetch actual pack (should be a zip file)
			const pack = await fetch(srcUrl)
				.then(
					async r =>
						new File(
							[await r.blob()],
							srcUrl.split("/").pop() ?? "pack.zip"
						)
				)
				.catch(() => null);

			// Check if pack is valid
			if (!pack) {
				console.log(
					`${chalk.red(`✗`)} Failed to fetch emoji pack from ${chalk.underline(
						srcUrl
					)}`
				);
				return 1;
			}

			// Validate sha256 if available
			if (Object.values(manifest)[0].src_sha256) {
				const sha256 = new Bun.SHA256()
					.update(await pack.arrayBuffer())
					.digest("hex");
				if (sha256 !== Object.values(manifest)[0].src_sha256) {
					console.log(
						`${chalk.red(`✗`)} SHA256 of pack (${chalk.blue(
							sha256
						)}) does not match manifest ${chalk.blue(
							Object.values(manifest)[0].src_sha256
						)}`
					);
					return 1;
				} else {
					console.log(
						`${chalk.green(`✓`)} SHA256 of pack matches manifest`
					);
				}
			} else {
				console.log(
					`${chalk.yellow(`⚠`)} No SHA256 in manifest, skipping validation`
				);
			}

			console.log(
				`${chalk.green(`✓`)} Fetched emoji pack from ${chalk.underline(srcUrl)}, unzipping to tempdir`
			);

			// Unzip the pack to temp dir
			const tempDir = await mkdtemp(join(tmpdir(), "bun-emoji-import-"));

			console.log(join(tempDir, pack.name));

			// Put the pack as a file
			await Bun.write(join(tempDir, pack.name), pack);

			await extract(join(tempDir, pack.name), {
				dir: tempDir,
			});

			console.log(
				`${chalk.green(`✓`)} Unzipped emoji pack to ${chalk.blue(tempDir)}`
			);

			console.log(
				`${chalk.blue(`⏳`)} Fetching emoji pack file metadata from ${chalk.underline(
					filesUrl
				)}`
			);

			// Fetch files URL
			const packFiles = await fetch(filesUrl)
				.then(r => r.json() as Promise<Record<string, string>>)
				.catch(() => null);

			if (!packFiles) {
				console.log(
					`${chalk.red(`✗`)} Failed to fetch emoji pack file metadata from ${chalk.underline(
						filesUrl
					)}`
				);
				return 1;
			}

			console.log(
				`${chalk.green(`✓`)} Fetched emoji pack file metadata from ${chalk.underline(
					filesUrl
				)}`
			);

			if (Object.keys(packFiles).length === 0) {
				console.log(`${chalk.red(`✗`)} Empty emoji pack`);
				return 1;
			}

			if (!noconfirm) {
				process.stdout.write(
					`Are you sure you want to import ${chalk.blue(
						Object.keys(packFiles).length
					)} emojis from ${chalk.underline(chalk.blue(url))}? [y/N] `
				);

				for await (const line of console) {
					if (line.trim().toLowerCase() === "y") {
						break;
					} else {
						console.log(`${chalk.red(`✗`)} Import cancelled`);
						return 0;
					}
				}
			}

			const successfullyImported: string[] = [];

			// Add emojis
			for (const [shortcode, url] of Object.entries(packFiles)) {
				// If emoji URL is not a valid URL, assume it's a relative path to homepage
				const fileUrl = Bun.pathToFileURL(
					join(tempDir, url)
				).toString();

				// Check if emoji already exists
				const existingEmoji = await client.emoji.findFirst({
					where: {
						shortcode: shortcode,
						instanceId: null,
					},
				});

				if (existingEmoji) {
					console.log(
						`${chalk.red(`✗`)} Emoji with shortcode ${chalk.blue(
							shortcode
						)} already exists`
					);
					continue;
				}

				// Add the emoji by calling the add command
				const returnCode = await cliBuilder.processArgs([
					"emoji",
					"add",
					shortcode,
					fileUrl,
					"--noconfirm",
				]);

				if (returnCode === 0) successfullyImported.push(shortcode);
			}

			console.log(
				`${chalk.green(`✓`)} Imported ${successfullyImported.length} emojis from ${chalk.underline(
					url
				)}`
			);

			// List imported
			if (successfullyImported.length > 0) {
				console.log(
					`${chalk.green(`✓`)} Successfully imported ${successfullyImported.length} emojis: ${successfullyImported.join(
						", "
					)}`
				);
			}

			// List unimported
			if (successfullyImported.length < Object.keys(packFiles).length) {
				const unimported = Object.keys(packFiles).filter(
					key => !successfullyImported.includes(key)
				);
				console.log(
					`${chalk.red(`✗`)} Failed to import ${unimported.length} emojis: ${unimported.join(
						", "
					)}`
				);
			}

			return 0;
		},
		"Imports a Pleroma emoji pack",
		"bun cli emoji import https://site.com/neofox/manifest.json"
	),
]);

const exitCode = await cliBuilder.processArgs(args);

process.exit(Number(exitCode == undefined ? 0 : exitCode));
