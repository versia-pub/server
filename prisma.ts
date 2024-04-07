import { config } from "config-manager";

// Proxies all `bunx prisma` commands with an environment variable

process.stdout.write(
    `postgresql://${config.database.username}:${config.database.password}@${config.database.host}:${config.database.port}/${config.database.database}\n`,
);

// Ends
process.exit(0);
