// Proxies all `bunx prisma` commands with an environment variable

import { getConfig } from "~classes/configmanager";

const config = getConfig();

process.stdout.write(
	`postgresql://${config.database.username}:${config.database.password}@${config.database.host}:${config.database.port}/${config.database.database}\n`
);

// Ends
process.exit(0);
