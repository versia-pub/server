import { Queue } from "bullmq";
import { getConfig } from "../utils/config";
import { PrismaClient } from "@prisma/client";

const config = getConfig();

const client = new PrismaClient({
	datasourceUrl: `postgresql://${config.database.username}:${config.database.password}@${config.database.host}:${config.database.port}/${config.database.database}`,
});

const federationQueue = new Queue("federation", {
	connection: {
		host: config.redis.queue.host,
		port: config.redis.queue.port,
		password: config.redis.queue.password,
		db: config.redis.queue.database,
	},
});

export { client, federationQueue };
