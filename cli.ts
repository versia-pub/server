import chalk from "chalk";
import { client } from "~database/datasource";
import { createNewLocalUser } from "~database/entities/User";

const args = process.argv;

const help = `
${chalk.bold(`Usage: bun cli <command> ${chalk.blue("[...flags]")} [...args]`)}

${chalk.bold("Commands:")}
    ${chalk.blue("help")} ${chalk.gray(
		"................."
	)} Show this help message
    ${chalk.blue("user")} ${chalk.gray(".................")} Manage users
        ${chalk.blue("create")} ${chalk.gray("...........")} Create a new user
            ${chalk.green("username")} ${chalk.gray(
				"....."
			)} Username of the user
            ${chalk.green("password")} ${chalk.gray(
				"....."
			)} Password of the user
            ${chalk.green("email")} ${chalk.gray("........")} Email of the user
            ${chalk.yellow("--admin")} ${chalk.gray(
				"......"
			)} Make the user an admin (optional)
            ${chalk.bold("Example:")} ${chalk.bgGray(
				`bun cli user create admin password123 admin@gmail.com --admin`
			)}
        ${chalk.blue("delete")} ${chalk.gray("...........")} Delete a user
            ${chalk.green("username")} ${chalk.gray(
				"....."
			)} Username of the user
            ${chalk.bold("Example:")} ${chalk.bgGray(
				`bun cli user delete admin`
			)}
        ${chalk.blue("list")} ${chalk.gray(".............")} List all users
            ${chalk.yellow("--admins")} ${chalk.gray(
				"....."
			)} List only admins (optional)
            ${chalk.bold("Example:")} ${chalk.bgGray(`bun cli user list`)}
`;

if (args.length < 3) {
	console.log(help);
	process.exit(0);
}

const command = args[2];

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
					)}`
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
			default:
				console.log(`Unknown command ${chalk.blue(command)}`);
				break;
		}
		break;
	default:
		console.log(`Unknown command ${chalk.blue(command)}`);
		break;
}
