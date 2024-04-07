import type { Prisma } from "@prisma/client";
import chalk from "chalk";
import { config } from "config-manager";
import Redis from "ioredis";
import { createPrismaRedisCache } from "prisma-redis-middleware";

const cacheRedis = config.redis.cache.enabled
	? new Redis({
			host: config.redis.cache.host,
			port: Number(config.redis.cache.port),
			password: config.redis.cache.password,
			db: Number(config.redis.cache.database),
		})
	: null;

cacheRedis?.on("error", e => {
	console.log(e);
});

export { cacheRedis };

export const initializeRedisCache = async () => {
	if (cacheRedis) {
		// Test connection
		try {
			await cacheRedis.ping();
		} catch (e) {
			console.error(
				`${chalk.red(`✗`)} ${chalk.bold(
					`Error while connecting to Redis`
				)}`
			);
			throw e;
		}

		console.log(`${chalk.green(`✓`)} ${chalk.bold(`Connected to Redis`)}`);

		const cacheMiddleware: Prisma.Middleware = createPrismaRedisCache({
			storage: {
				type: "redis",
				options: {
					client: cacheRedis,
					invalidation: {
						referencesTTL: 300,
					},
				},
			},
			cacheTime: 300,
			onError: e => {
				console.error(e);
			},
		});

		return cacheMiddleware;
	}

	return null;
};
