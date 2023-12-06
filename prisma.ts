// Proxies all `bunx prisma` commands with an environment variable

import { getConfig } from "@config";

const config = getConfig();

process.stdout.write(
	`postgresql://${config.database.username}:${config.database.password}@${config.database.host}:${config.database.port}/${config.database.database}`
);
