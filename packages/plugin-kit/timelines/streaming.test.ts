import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUIDv7 } from "bun";
import { setupDatabase, User } from "../db/index.ts";
import { connection } from "../redis.ts";
import {
    type EventTypes,
    StreamingTimeline,
    type TimelineTypes,
} from "./streaming.ts";

// Set up database and create test users
await setupDatabase();

const testUsers: User[] = [];

beforeAll(async (): Promise<void> => {
    // Ensure Redis is connected
    await connection.ping();

    // Create test users*
    // Can't use stuff from @versia-server/tests because it depends on this package
    for (let i = 0; i < 2; i++) {
        const user = await User.register(
            `test-streaming-${randomUUIDv7().slice(0, 8)}`,
            {
                email: `test-streaming-${i}@example.com`,
            },
        );
        testUsers.push(user);
    }
});

afterAll(async (): Promise<void> => {
    // Delete test users
    for (const user of testUsers) {
        await user.delete();
    }
});

describe("StreamingTimeline", (): void => {
    test("should create timeline with user", (): void => {
        const timeline = new StreamingTimeline("user", testUsers[0]);

        expect(timeline.timeline).toBe("user");
        expect(timeline.user).toBe(testUsers[0]);
        expect(timeline.emitter).toBeDefined();

        timeline.close();
    });

    test("should create timeline without user", (): void => {
        const timeline = new StreamingTimeline("public");

        expect(timeline.timeline).toBe("public");
        expect(timeline.user).toBe(null);
        expect(timeline.emitter).toBeDefined();

        timeline.close();
    });

    test("should generate correct channel name for user timeline", (): void => {
        const timeline = new StreamingTimeline("user", testUsers[0]);

        // Access private property for testing
        const channelName = (timeline as unknown as { channelName: string })
            .channelName;
        expect(channelName).toBe(`timeline:user:${testUsers[0].id}`);

        timeline.close();
    });

    test("should generate correct channel name for public timeline", (): void => {
        const timeline = new StreamingTimeline("public");

        // Access private property for testing
        const channelName = (timeline as unknown as { channelName: string })
            .channelName;
        expect(channelName).toBe("timeline:public");

        timeline.close();
    });

    test("should emit event when publishing to same channel", async (): Promise<void> => {
        const emitterTimeline = new StreamingTimeline("public");
        const receiverTimeline = new StreamingTimeline("public");
        let receivedType = "";
        let receivedPayload: unknown = null;

        // Listen for update events
        receiverTimeline.emitter.on("update", (payload): void => {
            receivedType = "update";
            receivedPayload = payload;
        });

        // Wait a bit for subscription to be established
        await new Promise((resolve): void => {
            setTimeout(resolve, 10);
        });

        // Emit an event
        emitterTimeline.emitEvent("update", { id: "test-status-123" });

        // Wait for event to be processed
        await new Promise((resolve): void => {
            setTimeout(resolve, 50);
        });

        expect(receivedType).toBe("update");
        expect(receivedPayload).toEqual({ id: "test-status-123" });

        emitterTimeline.close();
        receiverTimeline.close();
    });

    test("should not emit event for different channel", async (): Promise<void> => {
        const timeline1 = new StreamingTimeline("public");
        const timeline2 = new StreamingTimeline("user", testUsers[0]);

        let receivedEvent = false;

        // Listen for events on timeline1
        timeline1.emitter.on("update", (): void => {
            receivedEvent = true;
        });

        // Wait a bit for subscription to be established
        await new Promise((resolve): void => {
            setTimeout(resolve, 10);
        });

        // Emit event on timeline2 (different channel)
        timeline2.emitEvent("update", { id: "test-status-123" });

        // Wait for potential event processing
        await new Promise((resolve): void => {
            setTimeout(resolve, 50);
        });

        expect(receivedEvent).toBe(false);

        timeline1.close();
        timeline2.close();
    });

    test("should handle different event types", async (): Promise<void> => {
        const timeline = new StreamingTimeline("public");
        const receivedEvents: Array<{ type: string; payload: unknown }> = [];

        // Listen for different event types
        timeline.emitter.on("update", (payload): void => {
            receivedEvents.push({ type: "update", payload });
        });
        timeline.emitter.on("delete", (payload): void => {
            receivedEvents.push({ type: "delete", payload });
        });
        timeline.emitter.on("notification", (payload): void => {
            receivedEvents.push({ type: "notification", payload });
        });

        // Wait for subscription
        await new Promise((resolve): void => {
            setTimeout(resolve, 10);
        });

        // Emit different events
        timeline.emitEvent("update", { id: "status-1" });
        timeline.emitEvent("delete", { id: "status-2" });
        timeline.emitEvent("notification", { id: "notif-1" });

        // Wait for events
        await new Promise((resolve): void => {
            setTimeout(resolve, 100);
        });

        expect(receivedEvents).toHaveLength(3);
        expect(receivedEvents[0]).toEqual({
            type: "update",
            payload: { id: "status-1" },
        });
        expect(receivedEvents[1]).toEqual({
            type: "delete",
            payload: { id: "status-2" },
        });
        expect(receivedEvents[2]).toEqual({
            type: "notification",
            payload: { id: "notif-1" },
        });

        timeline.close();
    });

    test("should handle malformed JSON messages gracefully", async (): Promise<void> => {
        const timeline = new StreamingTimeline("public");

        let receivedEvent = false;
        let warningLogged = false;

        // Mock console.warn to capture warnings
        const originalWarn = console.warn;
        console.warn = (): void => {
            warningLogged = true;
        };

        timeline.emitter.on("update", (): void => {
            receivedEvent = true;
        });

        // Wait for subscription
        await new Promise((resolve): void => {
            setTimeout(resolve, 10);
        });

        // Publish malformed JSON directly to Redis
        const channelName = (timeline as unknown as { channelName: string })
            .channelName;
        await connection.publish(channelName, "invalid json");

        // Wait for message processing
        await new Promise((resolve): void => {
            setTimeout(resolve, 50);
        });

        expect(receivedEvent).toBe(false);
        expect(warningLogged).toBe(true);

        // Restore console.warn
        console.warn = originalWarn;
        timeline.close();
    });

    test("should handle messages with missing type or payload", async (): Promise<void> => {
        const timeline = new StreamingTimeline("public");

        let receivedEvent = false;

        timeline.emitter.on("update", (): void => {
            receivedEvent = true;
        });

        // Wait for subscription
        await new Promise((resolve): void => {
            setTimeout(resolve, 10);
        });

        // Publish message with missing type
        const channelName = (timeline as unknown as { channelName: string })
            .channelName;
        await connection.publish(
            channelName,
            JSON.stringify({ payload: { id: "test" } }),
        );

        // Publish message with missing payload
        await connection.publish(
            channelName,
            JSON.stringify({ type: "update" }),
        );

        // Wait for message processing
        await new Promise((resolve): void => {
            setTimeout(resolve, 50);
        });

        expect(receivedEvent).toBe(false);

        timeline.close();
    });

    test("should properly clean up resources on close", async (): Promise<void> => {
        const timeline = new StreamingTimeline("public");

        // Wait for subscription
        await new Promise((resolve): void => {
            setTimeout(resolve, 10);
        });

        // Verify subscription is active
        const channelName = (timeline as unknown as { channelName: string })
            .channelName;
        expect(
            timeline.redisConnection.listenerCount("message"),
        ).toBeGreaterThan(0);

        // Close timeline
        timeline.close();

        // Wait a bit
        await new Promise((resolve): void => {
            setTimeout(resolve, 10);
        });

        // Try to emit event - should not be received
        let receivedEvent = false;
        timeline.emitter.on("update", (): void => {
            receivedEvent = true;
        });

        await connection.publish(
            channelName,
            JSON.stringify({ type: "update", payload: { id: "test" } }),
        );

        await new Promise((resolve): void => {
            setTimeout(resolve, 50);
        });

        expect(receivedEvent).toBe(false);
    });

    test("should handle multiple timelines with different channels", async (): Promise<void> => {
        const timeline1 = new StreamingTimeline("public");
        const timeline2 = new StreamingTimeline("user", testUsers[0]);
        const timeline3 = new StreamingTimeline("user", testUsers[1]);

        const events1: unknown[] = [];
        const events2: unknown[] = [];
        const events3: unknown[] = [];

        timeline1.emitter.on("update", (payload): void => {
            events1.push(payload);
        });
        timeline2.emitter.on("update", (payload): void => {
            events2.push(payload);
        });
        timeline3.emitter.on("update", (payload): void => {
            events3.push(payload);
        });

        // Wait for subscriptions
        await new Promise((resolve): void => {
            setTimeout(resolve, 20);
        });

        // Emit events to different timelines
        timeline1.emitEvent("update", { id: "public-1" });
        timeline2.emitEvent("update", { id: "user1-1" });
        timeline3.emitEvent("update", { id: "user2-1" });

        // Wait for events
        await new Promise((resolve): void => {
            setTimeout(resolve, 100);
        });

        expect(events1).toEqual([{ id: "public-1" }]);
        expect(events2).toEqual([{ id: "user1-1" }]);
        expect(events3).toEqual([{ id: "user2-1" }]);

        timeline1.close();
        timeline2.close();
        timeline3.close();
    });

    test("should handle filters_changed event with null payload", async (): Promise<void> => {
        const timeline = new StreamingTimeline("public");
        let receivedType = "";
        let receivedPayload: unknown;

        timeline.emitter.on("filters_changed", (payload): void => {
            receivedType = "filters_changed";
            receivedPayload = payload;
        });

        await new Promise((resolve): void => {
            setTimeout(resolve, 10);
        });

        timeline.emitEvent("filters_changed", null);

        await new Promise((resolve): void => {
            setTimeout(resolve, 50);
        });

        expect(receivedType).toBe("filters_changed");
        expect(receivedPayload).toBeNull();

        timeline.close();
    });

    test("should handle all supported timeline types", (): void => {
        const timelineTypes: TimelineTypes[] = [
            "public",
            "public:media",
            "public:local",
            "public:local:media",
            "public:remote",
            "public:remote:media",
            "hashtag",
            "hashtag:local",
            "user",
            "user:notification",
            "list",
        ];

        const timelines = timelineTypes.map(
            (type) => new StreamingTimeline(type),
        );

        for (const [index, timeline] of timelines.entries()) {
            expect(timeline.timeline).toBe(timelineTypes[index]);
            const channelName = (timeline as unknown as { channelName: string })
                .channelName;
            expect(channelName).toBe(`timeline:${timelineTypes[index]}`);
        }

        // Clean up
        for (const timeline of timelines) {
            timeline.close();
        }
    });

    test("should handle all supported event types", async (): Promise<void> => {
        const timeline = new StreamingTimeline("public");
        const eventTypes: EventTypes[] = [
            "update",
            "delete",
            "notification",
            "filters_changed",
            "announcement",
            "announcement.reaction",
            "announcement.delete",
            "status.update",
        ];

        const receivedEvents: Array<{ type: string; payload: unknown }> = [];

        // Set up listeners for all event types
        for (const eventType of eventTypes) {
            timeline.emitter.on(eventType, (payload): void => {
                receivedEvents.push({ type: eventType, payload });
            });
        }

        await new Promise((resolve): void => {
            setTimeout(resolve, 10);
        });

        // Emit all event types
        for (const [index, eventType] of eventTypes.entries()) {
            const payload =
                eventType === "filters_changed"
                    ? null
                    : { id: `${eventType}-${index}` };
            timeline.emitEvent(eventType, payload as never);
        }

        await new Promise((resolve): void => {
            setTimeout(resolve, 100);
        });

        expect(receivedEvents).toHaveLength(eventTypes.length);
        for (const [index, eventType] of eventTypes.entries()) {
            const expectedPayload =
                eventType === "filters_changed"
                    ? null
                    : { id: `${eventType}-${index}` };
            expect(receivedEvents[index]).toEqual({
                type: eventType,
                payload: expectedPayload,
            });
        }

        timeline.close();
    });
});
