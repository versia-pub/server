import IORedis from "ioredis";
import { config } from "~/packages/config-manager/index.ts";

export const connection = new IORedis({
    host: config.redis.queue.host,
    port: config.redis.queue.port,
    password: config.redis.queue.password,
    db: config.redis.queue.database,
    maxRetriesPerRequest: null,
});
