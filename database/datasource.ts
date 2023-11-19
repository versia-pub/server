import { getConfig } from "../utils/config";
import { PrismaClient } from "@prisma/client";

const config = getConfig();

const client = new PrismaClient({
	datasourceUrl: `postgresql://${config.database.username}:${config.database.password}@${config.database.host}:${config.database.port}/${config.database.database}`,
});

export { client };
