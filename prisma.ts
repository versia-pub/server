// Proxies all `bunx prisma` commands with an environment variable

import { getConfig } from "@config";

const args = process.argv.slice(2);
const config = getConfig();

const { stdout } = Bun.spawn(["bunx", "prisma", ...args], {
	env: {
		...process.env,
		DATABASE_URL: `postgresql://${config.database.username}:${config.database.password}@${config.database.host}:${config.database.port}/${config.database.database}`,
	},
});

// Show stdout
const text = await new Response(stdout).text();
console.log(text); // => "hello"
