import type { Prisma } from "@prisma/client";
import chalk from "chalk";
import { client } from "~database/datasource";
import { createNewLocalUser } from "~database/entities/User";
import Table from "cli-table";
import { rebuildSearchIndexes, MeiliIndexType } from "@meilisearch";
import { getConfig } from "@config";
import { uploadFile } from "~classes/media";
import { getUrl } from "~database/entities/Attachment";
import { mkdir, exists } from "fs/promises";
import extract from "extract-zip";

const args = process.argv;

/**
 * Make the text have a width of 20 characters, padding with gray dots
 * Text can be a Chalk string, in which case formatting codes should not be counted in text length
 * @param text The text to align
 */
const alignDots = (text: string, length = 20) => {
	// Remove formatting codes
	// eslint-disable-next-line no-control-regex
	const textLength = text.replace(/\u001b\[\d+m/g, "").length;
	const dots = ".".repeat(length - textLength);
	return `${text}${chalk.gray(dots)}`;
};

const alignDotsSmall = (text: string, length = 16) => alignDots(text, length);

const help = `
${chalk.bold(`Usage: bun cli <command> ${chalk.blue("[...flags]")} [...args]`)}

${chalk.bold("Commands:")}
    ${alignDots(chalk.blue("help"), 24)} Show this help message
    ${alignDots(chalk.blue("user"), 24)} Manage users
        ${alignDots(chalk.blue("create"))} Create a new user
            ${alignDotsSmall(chalk.green("username"))} Username of the user
            ${alignDotsSmall(chalk.green("password"))} Password of the user
            ${alignDotsSmall(chalk.green("email"))} Email of the user
            ${alignDotsSmall(
				chalk.yellow("--admin")
			)} Make the user an admin (optional)
            ${chalk.bold("Example:")} ${chalk.bgGray(
				`bun cli user create admin password123 admin@gmail.com --admin`
			)}
        ${alignDots(chalk.blue("delete"))} Delete a user
            ${alignDotsSmall(chalk.green("username"))} Username of the user
            ${chalk.bold("Example:")} ${chalk.bgGray(
				`bun cli user delete admin`
			)}
        ${alignDots(chalk.blue("list"))} List all users
            ${alignDotsSmall(
				chalk.yellow("--admins")
			)} List only admins (optional)
            ${chalk.bold("Example:")} ${chalk.bgGray(`bun cli user list`)}
        ${alignDots(chalk.blue("search"))} Search for a user
            ${alignDotsSmall(chalk.green("query"))} Query to search for
            ${alignDotsSmall(
				chalk.yellow("--displayname")
			)} Search by display name (optional)
            ${alignDotsSmall(chalk.yellow("--bio"))} Search in bio (optional)
            ${alignDotsSmall(
				chalk.yellow("--local")
			)} Search in local users (optional)
            ${alignDotsSmall(
				chalk.yellow("--remote")
			)} Search in remote users (optional)
            ${alignDotsSmall(
				chalk.yellow("--email")
			)} Search in emails (optional)
            ${alignDotsSmall(chalk.yellow("--json"))} Output as JSON (optional)
            ${alignDotsSmall(chalk.yellow("--csv"))} Output as CSV (optional)
            ${chalk.bold("Example:")} ${chalk.bgGray(
				`bun cli user search admin`
			)}
    ${alignDots(chalk.blue("note"), 24)} Manage notes
        ${alignDots(chalk.blue("delete"))} Delete a note
            ${alignDotsSmall(chalk.green("id"))} ID of the note
            ${chalk.bold("Example:")} ${chalk.bgGray(
				`bun cli note delete 018c1838-6e0b-73c4-a157-a91ea4e25d1d`
			)}
        ${alignDots(chalk.blue("search"))} Search for a status
            ${alignDotsSmall(chalk.green("query"))} Query to search for
            ${alignDotsSmall(
				chalk.yellow("--local")
			)} Search in local statuses (optional)
            ${alignDotsSmall(
				chalk.yellow("--remote")
			)} Search in remote statuses (optional)
            ${alignDotsSmall(chalk.yellow("--json"))} Output as JSON (optional)
            ${alignDotsSmall(chalk.yellow("--csv"))} Output as CSV (optional)
            ${chalk.bold("Example:")} ${chalk.bgGray(
				`bun cli note search hello`
			)}
    ${alignDots(chalk.blue("index"), 24)} Manage user and status indexes
        ${alignDots(chalk.blue("rebuild"))} Rebuild the index
            ${alignDotsSmall(
				chalk.green("batch-size")
			)} The number of items to index at once (optional, default 100)
            ${alignDotsSmall(
				chalk.yellow("--statuses")
			)} Only rebuild the statuses index (optional)
            ${alignDotsSmall(
				chalk.yellow("--users")
			)} Only rebuild the users index (optional)
            ${chalk.bold("Example:")} ${chalk.bgGray(
				`bun cli index rebuild --users 200`
			)}
    ${alignDots(chalk.blue("emoji"), 24)} Manage custom emojis
        ${alignDots(chalk.blue("add"))} Add a custom emoji
            ${alignDotsSmall(chalk.green("name"))} Name of the emoji
            ${alignDotsSmall(chalk.green("url"))} URL of the emoji
            ${chalk.bold("Example:")} ${chalk.bgGray(
				`bun cli emoji add bun https://bun.com/bun.png`
			)}
        ${alignDots(chalk.blue("delete"))} Delete a custom emoji
            ${alignDotsSmall(chalk.green("name"))} Name of the emoji
            ${chalk.bold("Example:")} ${chalk.bgGray(
				`bun cli emoji delete bun`
			)}
        ${alignDots(chalk.blue("list"))} List all custom emojis
            ${chalk.bold("Example:")} ${chalk.bgGray(`bun cli emoji list`)}
        ${alignDots(chalk.blue("search"))} Search for a custom emoji
            ${alignDotsSmall(chalk.green("query"))} Query to search for
            ${alignDotsSmall(
				chalk.yellow("--local")
			)} Search in local emojis (optional, default)
            ${alignDotsSmall(
				chalk.yellow("--remote")
			)} Search in remote emojis (optional)
            ${alignDotsSmall(chalk.yellow("--json"))} Output as JSON (optional)
            ${alignDotsSmall(chalk.yellow("--csv"))} Output as CSV (optional)
            ${chalk.bold("Example:")} ${chalk.bgGray(
				`bun cli emoji search bun`
			)}
        ${alignDots(chalk.blue("import"))} Import a Pleroma emoji pack
            ${alignDotsSmall(chalk.green("url"))} URL of the emoji pack
            ${chalk.bold("Example:")} ${chalk.bgGray(
				`bun cli emoji import https://site.com/neofox/manifest.json`
			)}
`;

if (args.length < 3) {
	console.log(help);
	process.exit(0);
}

const command = args[2];

const config = getConfig();

switch (command) {
	case "help":
		console.log(help);
		break;
	case "user":
		switch (args[3]) {
			case "create": {
				// Check if --admin flag is provided
				const argsWithFlags = args.filter(arg => arg.startsWith("--"));
				const argsWithoutFlags = args.filter(
					arg => !arg.startsWith("--")
				);

				const username = argsWithoutFlags[4];
				const password = argsWithoutFlags[5];
				const email = argsWithoutFlags[6];

				const admin = argsWithFlags.includes("--admin");

				// Check if username, password and email are provided
				if (!username || !password || !email) {
					console.log(
						`${chalk.red(`✗`)} Missing username, password or email`
					);
					process.exit(1);
				}

				// Check if user already exists
				const user = await client.user.findFirst({
					where: {
						OR: [{ username }, { email }],
					},
				});

				if (user) {
					console.log(`${chalk.red(`✗`)} User already exists`);
					process.exit(1);
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
				break;
			}
			case "delete": {
				const username = args[4];

				if (!username) {
					console.log(`${chalk.red(`✗`)} Missing username`);
					process.exit(1);
				}

				const user = await client.user.findFirst({
					where: {
						username: username,
					},
				});

				if (!user) {
					console.log(`${chalk.red(`✗`)} User not found`);
					process.exit(1);
				}

				await client.user.delete({
					where: {
						id: user.id,
					},
				});

				console.log(
					`${chalk.green(`✓`)} Deleted user ${chalk.blue(
						user.username
					)}`
				);

				break;
			}
			case "list": {
				const admins = args.includes("--admins");

				const users = await client.user.findMany({
					where: {
						isAdmin: admins || undefined,
					},
					take: 200,
				});

				console.log(
					`${chalk.green(`✓`)} Found ${chalk.blue(
						users.length
					)} users`
				);

				for (const user of users) {
					console.log(
						`\t${chalk.blue(user.username)} ${chalk.gray(
							user.email
						)} ${chalk.green(user.isAdmin ? "Admin" : "User")}`
					);
				}
				break;
			}
			case "search": {
				const argsWithoutFlags = args.filter(
					arg => !arg.startsWith("--")
				);
				const query = argsWithoutFlags[4];

				if (!query) {
					console.log(`${chalk.red(`✗`)} Missing query`);
					process.exit(1);
				}

				const displayname = args.includes("--displayname");
				const bio = args.includes("--bio");
				const local = args.includes("--local");
				const remote = args.includes("--remote");
				const email = args.includes("--email");
				const json = args.includes("--json");
				const csv = args.includes("--csv");

				const queries: Prisma.UserWhereInput[] = [];

				if (displayname) {
					queries.push({
						displayName: {
							contains: query,
							mode: "insensitive",
						},
					});
				}

				if (bio) {
					queries.push({
						note: {
							contains: query,
							mode: "insensitive",
						},
					});
				}

				if (local) {
					queries.push({
						instanceId: null,
					});
				}

				if (remote) {
					queries.push({
						instanceId: {
							not: null,
						},
					});
				}

				if (email) {
					queries.push({
						email: {
							contains: query,
							mode: "insensitive",
						},
					});
				}

				const users = await client.user.findMany({
					where: {
						AND: queries,
					},
					include: {
						instance: true,
					},
					take: 40,
				});

				if (json || csv) {
					if (json) {
						console.log(JSON.stringify(users, null, 4));
					}
					if (csv) {
						// Convert the outputted JSON to CSV

						// Remove all object children from each object
						const items = users.map(user => {
							const item = {
								...user,
								instance: undefined,
								endpoints: undefined,
								source: undefined,
							};
							return item;
						});
						const replacer = (key: string, value: any): any =>
							value === null ? "" : value; // Null values are returned as empty strings
						const header = Object.keys(items[0]);
						const csv = [
							header.join(","), // header row first
							...items.map(row =>
								header
									.map(fieldName =>
										// @ts-expect-error This is fine
										JSON.stringify(row[fieldName], replacer)
									)
									.join(",")
							),
						].join("\r\n");

						console.log(csv);
					}
				} else {
					console.log(
						`${chalk.green(`✓`)} Found ${chalk.blue(
							users.length
						)} users`
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
								user.instanceId
									? user.instance?.base_url
									: "Local"
							),
						]);
					}

					console.log(table.toString());
				}

				break;
			}
			default:
				console.log(`Unknown command ${chalk.blue(command)}`);
				break;
		}
		break;
	case "note": {
		switch (args[3]) {
			case "delete": {
				const id = args[4];

				if (!id) {
					console.log(`${chalk.red(`✗`)} Missing ID`);
					process.exit(1);
				}

				const note = await client.status.findFirst({
					where: {
						id: id,
					},
				});

				if (!note) {
					console.log(`${chalk.red(`✗`)} Note not found`);
					process.exit(1);
				}

				await client.status.delete({
					where: {
						id: note.id,
					},
				});

				console.log(
					`${chalk.green(`✓`)} Deleted note ${chalk.blue(note.id)}`
				);

				break;
			}
			case "search": {
				const argsWithoutFlags = args.filter(
					arg => !arg.startsWith("--")
				);
				const query = argsWithoutFlags[4];

				if (!query) {
					console.log(`${chalk.red(`✗`)} Missing query`);
					process.exit(1);
				}

				const local = args.includes("--local");
				const remote = args.includes("--remote");
				const json = args.includes("--json");
				const csv = args.includes("--csv");

				const queries: Prisma.StatusWhereInput[] = [];

				if (local) {
					queries.push({
						instanceId: null,
					});
				}

				if (remote) {
					queries.push({
						instanceId: {
							not: null,
						},
					});
				}

				const statuses = await client.status.findMany({
					where: {
						AND: queries,
						content: {
							contains: query,
							mode: "insensitive",
						},
					},
					take: 40,
					include: {
						author: true,
						instance: true,
					},
				});

				if (json || csv) {
					if (json) {
						console.log(JSON.stringify(statuses, null, 4));
					}
					if (csv) {
						// Convert the outputted JSON to CSV

						// Remove all object children from each object
						const items = statuses.map(status => {
							const item = {
								...status,
								author: undefined,
								instance: undefined,
							};
							return item;
						});
						const replacer = (key: string, value: any): any =>
							value === null ? "" : value; // Null values are returned as empty strings
						const header = Object.keys(items[0]);
						const csv = [
							header.join(","), // header row first
							...items.map(row =>
								header
									.map(fieldName =>
										// @ts-expect-error This is fine
										JSON.stringify(row[fieldName], replacer)
									)
									.join(",")
							),
						].join("\r\n");

						console.log(csv);
					}
				} else {
					console.log(
						`${chalk.green(`✓`)} Found ${chalk.blue(
							statuses.length
						)} statuses`
					);

					const table = new Table({
						head: [
							chalk.white(chalk.bold("Username")),
							chalk.white(chalk.bold("Instance URL")),
							chalk.white(chalk.bold("Content")),
						],
					});

					for (const status of statuses) {
						table.push([
							chalk.yellow(`@${status.author.username}`),
							chalk.blue(
								status.instanceId
									? status.instance?.base_url
									: "Local"
							),
							chalk.green(status.content.slice(0, 50)),
						]);
					}

					console.log(table.toString());
				}

				break;
			}
			default:
				console.log(`Unknown command ${chalk.blue(command)}`);
				break;
		}
		break;
	}
	case "index": {
		if (!config.meilisearch.enabled) {
			console.log(
				`${chalk.red(`✗`)} Meilisearch is not enabled in the config`
			);
			process.exit(1);
		}
		switch (args[3]) {
			case "rebuild": {
				const statuses = args.includes("--statuses");
				const users = args.includes("--users");

				const argsWithoutFlags = args.filter(
					arg => !arg.startsWith("--")
				);

				const batchSize = Number(argsWithoutFlags[4]) || 100;

				const neither = !statuses && !users;

				if (statuses || neither) {
					console.log(
						`${chalk.yellow(`⚠`)} ${chalk.bold(
							`Rebuilding Meilisearch index for statuses`
						)}`
					);

					const timeBefore = performance.now();

					await rebuildSearchIndexes(
						[MeiliIndexType.Statuses],
						batchSize
					);

					console.log(
						`${chalk.green(`✓`)} ${chalk.bold(
							`Meilisearch index for statuses rebuilt in ${chalk.bgGreen(
								(performance.now() - timeBefore).toFixed(2)
							)}ms`
						)}`
					);
				}

				if (users || neither) {
					console.log(
						`${chalk.yellow(`⚠`)} ${chalk.bold(
							`Rebuilding Meilisearch index for users`
						)}`
					);

					const timeBefore = performance.now();

					await rebuildSearchIndexes(
						[MeiliIndexType.Accounts],
						batchSize
					);

					console.log(
						`${chalk.green(`✓`)} ${chalk.bold(
							`Meilisearch index for users rebuilt in ${chalk.bgGreen(
								(performance.now() - timeBefore).toFixed(2)
							)}ms`
						)}`
					);
				}

				break;
			}
			default:
				console.log(`Unknown command ${chalk.blue(command)}`);
				break;
		}
		break;
	}
	case "emoji": {
		switch (args[3]) {
			case "add": {
				const name = args[4];
				const url = args[5];

				if (!name || !url) {
					console.log(`${chalk.red(`✗`)} Missing name or URL`);
					process.exit(1);
				}

				const content_type = `image/${url
					.split(".")
					.pop()
					?.replace("jpg", "jpeg")}}`;

				const emoji = await client.emoji.create({
					data: {
						shortcode: name,
						url: url,
						visible_in_picker: true,
						content_type: content_type,
					},
				});

				console.log(
					`${chalk.green(`✓`)} Created emoji ${chalk.blue(
						emoji.shortcode
					)}`
				);

				break;
			}
			case "delete": {
				const name = args[4];

				if (!name) {
					console.log(`${chalk.red(`✗`)} Missing name`);
					process.exit(1);
				}

				const emoji = await client.emoji.findFirst({
					where: {
						shortcode: name,
					},
				});

				if (!emoji) {
					console.log(`${chalk.red(`✗`)} Emoji not found`);
					process.exit(1);
				}

				await client.emoji.delete({
					where: {
						id: emoji.id,
					},
				});

				console.log(
					`${chalk.green(`✓`)} Deleted emoji ${chalk.blue(
						emoji.shortcode
					)}`
				);

				break;
			}
			case "list": {
				const emojis = await client.emoji.findMany();

				console.log(
					`${chalk.green(`✓`)} Found ${chalk.blue(
						emojis.length
					)} emojis`
				);

				for (const emoji of emojis) {
					console.log(
						`\t${chalk.blue(emoji.shortcode)} ${chalk.gray(
							emoji.url
						)}`
					);
				}
				break;
			}
			case "search": {
				const argsWithoutFlags = args.filter(
					arg => !arg.startsWith("--")
				);
				const query = argsWithoutFlags[4];

				if (!query) {
					console.log(`${chalk.red(`✗`)} Missing query`);
					process.exit(1);
				}

				const local = args.includes("--local");
				const remote = args.includes("--remote");
				const json = args.includes("--json");
				const csv = args.includes("--csv");

				const queries: Prisma.EmojiWhereInput[] = [];

				if (local) {
					queries.push({
						instanceId: null,
					});
				}

				if (remote) {
					queries.push({
						instanceId: {
							not: null,
						},
					});
				}

				const emojis = await client.emoji.findMany({
					where: {
						AND: queries,
						shortcode: {
							contains: query,
							mode: "insensitive",
						},
					},
					take: 40,
					include: {
						instance: true,
					},
				});

				if (json || csv) {
					if (json) {
						console.log(JSON.stringify(emojis, null, 4));
					}
					if (csv) {
						// Convert the outputted JSON to CSV

						// Remove all object children from each object
						const items = emojis.map(emoji => {
							const item = {
								...emoji,
								instance: undefined,
							};
							return item;
						});
						const replacer = (key: string, value: any): any =>
							value === null ? "" : value; // Null values are returned as empty strings
						const header = Object.keys(items[0]);
						const csv = [
							header.join(","), // header row first
							...items.map(row =>
								header
									.map(fieldName =>
										// @ts-expect-error This is fine
										JSON.stringify(row[fieldName], replacer)
									)
									.join(",")
							),
						].join("\r\n");

						console.log(csv);
					}
				} else {
					console.log(
						`${chalk.green(`✓`)} Found ${chalk.blue(
							emojis.length
						)} emojis`
					);

					const table = new Table({
						head: [
							chalk.white(chalk.bold("Shortcode")),
							chalk.white(chalk.bold("Instance URL")),
							chalk.white(chalk.bold("URL")),
						],
					});

					for (const emoji of emojis) {
						table.push([
							chalk.yellow(`:${emoji.shortcode}:`),
							chalk.blue(
								emoji.instanceId
									? emoji.instance?.base_url
									: "Local"
							),
							chalk.gray(emoji.url),
						]);
					}

					console.log(table.toString());
				}

				break;
			}
			case "import": {
				const url = args[4];

				if (!url) {
					console.log(`${chalk.red(`✗`)} Missing URL`);
					process.exit(1);
				}

				const response = await fetch(url);

				if (!response.ok) {
					console.log(`${chalk.red(`✗`)} Failed to fetch emoji pack`);
					process.exit(1);
				}

				const res = (await response.json()) as Record<
					string,
					{
						description: string;
						files: string;
						homepage: string;
						src: string;
						src_sha256?: string;
						license?: string;
					}
				>;

				const pack = Object.values(res)[0];

				// Fetch emoji list from `files`, can be a relative URL

				if (!pack.files) {
					console.log(`${chalk.red(`✗`)} Missing files`);
					process.exit(1);
				}

				let pack_url = pack.files;

				if (!pack.files.includes("http")) {
					// Is relative URL to pack manifest URL
					pack_url =
						url.split("/").slice(0, -1).join("/") +
						"/" +
						pack.files;
				}

				const zip = new File(
					[await (await fetch(pack.src)).arrayBuffer()],
					"emoji.zip",
					{
						type: "application/zip",
					}
				);

				// Check if the SHA256 hash matches
				const hasher = new Bun.SHA256();

				hasher.update(await zip.arrayBuffer());

				const hash = hasher.digest("hex");

				if (pack.src_sha256 && pack.src_sha256 !== hash) {
					console.log(`${chalk.red(`✗`)} SHA256 hash does not match`);
					console.log(
						`${chalk.red(`✗`)} Expected ${chalk.blue(
							pack.src_sha256
						)}, got ${chalk.blue(hash)}`
					);
					process.exit(1);
				}

				// Store file in /tmp
				const tempDirectory = `/tmp/lysand-${hash}`;

				if (!(await exists(tempDirectory))) {
					await mkdir(tempDirectory);
				}

				await Bun.write(`${tempDirectory}/emojis.zip`, zip);

				// Extract zip
				await extract(`${tempDirectory}/emojis.zip`, {
					dir: tempDirectory,
				});

				// In the format
				// emoji_name: emoji_url
				const pack_response = (await (
					await fetch(pack_url)
				).json()) as Record<string, string>;

				let emojisCreated = 0;

				for (const [name, path] of Object.entries(pack_response)) {
					// Check if emoji already exists
					const existingEmoji = await client.emoji.findFirst({
						where: {
							shortcode: name,
							instanceId: null,
						},
					});

					if (existingEmoji) {
						console.log(
							`${chalk.red(`✗`)} Emoji ${chalk.blue(
								name
							)} already exists`
						);
						continue;
					}

					// Get emoji URL, as it can be relative

					const emoji = Bun.file(`${tempDirectory}/${path}`);

					const content_type = emoji.type;

					const hash = await uploadFile(emoji as File, config);

					if (!hash) {
						console.log(
							`${chalk.red(`✗`)} Failed to upload emoji ${name}`
						);
						process.exit(1);
					}

					const finalUrl = getUrl(hash, config);

					// Create emoji
					await client.emoji.create({
						data: {
							shortcode: name,
							url: finalUrl,
							visible_in_picker: true,
							content_type: content_type,
						},
					});

					emojisCreated++;

					console.log(
						`${chalk.green(`✓`)} Created emoji ${chalk.blue(name)}`
					);
				}

				console.log(
					`${chalk.green(`✓`)} Imported ${chalk.blue(
						emojisCreated
					)} emojis`
				);

				break;
			}
			default:
				console.log(`Unknown command ${chalk.blue(command)}`);
				break;
		}

		break;
	}
	default:
		console.log(`Unknown command ${chalk.blue(command)}`);
		break;
}

process.exit(0);
