/**
 * Handles live updates to timelines using Redis to communicate between instances.
 *
 * Used in the Streaming API to push updates to clients in real-time.
 * @see https://docs.joinmastodon.org/methods/streaming/#websocket
 */

import { config } from "@versia-server/config";
import IORedis from "ioredis";
import mitt from "mitt";
import type { User } from "../db/user.ts";
import { connection } from "../redis.ts";

export type TimelineTypes =
    | "public"
    | "public:media"
    | "public:local"
    | "public:local:media"
    | "public:remote"
    | "public:remote:media"
    | "hashtag"
    | "hashtag:local"
    | "user"
    | "user:notification"
    | "list";

export type EventTypes =
    | "update"
    | "delete"
    | "notification"
    | "filters_changed"
    | "announcement"
    | "announcement.reaction"
    | "announcement.delete"
    | "status.update";

export type EventPayloads = {
    update: { id: string };
    delete: { id: string };
    notification: { id: string };
    filters_changed: null;
    announcement: { id: string };
    "announcement.reaction": { id: string };
    "announcement.delete": { id: string };
    "status.update": { id: string };
};

export class StreamingTimeline {
    public readonly emitter =
        mitt<{
            [K in EventTypes]: EventPayloads[K];
        }>();
    public readonly redisConnection: IORedis;

    public constructor(
        public readonly timeline: TimelineTypes,
        public readonly user: User | null = null,
    ) {
        this.redisConnection = new IORedis({
            host: config.redis.queue.host,
            port: config.redis.queue.port,
            password: config.redis.queue.password,
            db: config.redis.queue.database,
            maxRetriesPerRequest: null,
        });
        this.initializeRedisWatcher();
    }

    private get channelName(): string {
        if (this.user) {
            return `timeline:${this.timeline}:${this.user.id}`;
        }

        return `timeline:${this.timeline}`;
    }

    private messageHandler = (channel: string, message: string): void => {
        if (channel === this.channelName) {
            try {
                const parsed = JSON.parse(message);
                if (
                    typeof parsed === "object" &&
                    parsed !== null &&
                    "type" in parsed &&
                    "payload" in parsed
                ) {
                    const { type, payload } = parsed as {
                        type: EventTypes;
                        payload: unknown;
                    };
                    this.emitter.emit(
                        type,
                        payload as EventPayloads[typeof type],
                    );
                }
            } catch (error) {
                // Silently ignore malformed messages
                console.warn("Failed to parse streaming message:", error);
            }
        }
    };

    private initializeRedisWatcher(): void {
        this.redisConnection.subscribe(this.channelName);
        this.redisConnection.on("message", this.messageHandler);
    }

    public close(): void {
        this.redisConnection.unsubscribe(this.channelName);
        this.redisConnection.off("message", this.messageHandler);
    }

    public emitEvent<K extends EventTypes>(
        type: K,
        payload: EventPayloads[K],
    ): void {
        connection.publish(this.channelName, JSON.stringify({ type, payload }));
    }
}
