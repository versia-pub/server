// import { Queue } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { config } from "config-manager";

const client = new PrismaClient({
    datasourceUrl: `postgresql://${config.database.username}:${config.database.password}@${config.database.host}:${config.database.port}/${config.database.database}`,
});

/* const federationQueue = new Queue("federation", {
	connection: {
		host: config.redis.queue.host,
		port: Number(config.redis.queue.port),
		password: config.redis.queue.password || undefined,
		db: config.redis.queue.database || undefined,
	},
}); */

export { client /* federationQueue */ };
