import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { PushSubscription } from "@versia/kit/db";
import { generateClient, getTestUsers } from "@versia-server/tests";
import { randomUUIDv7 } from "bun";

const { users, tokens, deleteUsers } = await getTestUsers(2);

afterAll(async () => {
    await deleteUsers();
});

beforeEach(async () => {
    await PushSubscription.clearAllOfToken(tokens[0]);
    await PushSubscription.clearAllOfToken(tokens[1]);
});

describe("/api/v1/push/subscriptions", () => {
    test("should create a push subscription", async () => {
        await using client = await generateClient(users[0]);

        const { ok, data } = await client.subscribePushNotifications(
            {
                endpoint: "https://example.com",
                keys: {
                    auth: "test",
                    p256dh: "test",
                },
            },
            {
                alerts: {
                    update: true,
                },
                policy: "all",
            },
        );

        expect(ok).toBe(true);
        expect(data.endpoint).toBe("https://example.com");
        expect(data.alerts).toMatchObject({
            update: true,
        });
    });

    test("should retrieve the same push subscription", async () => {
        await using client = await generateClient(users[1]);

        await PushSubscription.insert({
            id: randomUUIDv7(),
            endpoint: "https://example.com",
            alerts: {
                update: true,
                "admin.report": false,
                "admin.sign_up": false,
                favourite: false,
                follow: false,
                follow_request: false,
                mention: false,
                poll: false,
                reblog: false,
                status: false,
            },
            policy: "all",
            authSecret: "test",
            publicKey: "test",
            tokenId: client.dbToken.id,
        });

        const { ok, data } = await client.getPushSubscription();

        expect(ok).toBe(true);
        expect(data.endpoint).toBe("https://example.com");
        expect(data.alerts).toMatchObject({
            update: true,
        });
    });

    test("should update a push subscription", async () => {
        await using client = await generateClient(users[0]);

        await PushSubscription.insert({
            id: randomUUIDv7(),
            endpoint: "https://example.com",
            alerts: {
                update: true,
                "admin.report": false,
                "admin.sign_up": false,
                favourite: false,
                follow: false,
                follow_request: false,
                mention: false,
                poll: false,
                reblog: false,
                status: false,
            },
            policy: "all",
            authSecret: "test",
            publicKey: "test",
            tokenId: client.dbToken.id,
        });

        const { ok, data } = await client.updatePushSubscription(
            {
                alerts: {
                    update: false,
                    favourite: true,
                },
            },
            "follower",
        );

        expect(ok).toBe(true);
        expect(data.alerts).toMatchObject({
            update: false,
            favourite: true,
        });
    });

    describe("permissions", () => {
        test("should not allow watching admin reports without permissions", async () => {
            await using client = await generateClient(users[0]);

            const { data, ok } = await client.subscribePushNotifications(
                {
                    endpoint: "https://example.com",
                    keys: {
                        auth: "testthatis24charactersha",
                        p256dh: "test",
                    },
                },
                {
                    alerts: {
                        "admin.report": true,
                    },
                    policy: "all",
                },
            );

            expect(ok).toBe(true);
            expect(data.alerts).toMatchObject({
                "admin.report": false,
            });
        });

        test("should allow watching admin reports with permissions", async () => {
            await users[0].update({
                isAdmin: true,
            });

            await using client = await generateClient(users[0]);

            const { ok, data } = await client.subscribePushNotifications(
                {
                    endpoint: "https://example.com",
                    keys: {
                        auth: "testthatis24charactersha",
                        p256dh: "test",
                    },
                },
                {
                    alerts: {
                        "admin.report": true,
                    },
                    policy: "all",
                },
            );

            expect(ok).toBe(true);
            expect(data.alerts).toMatchObject({
                "admin.report": true,
            });

            await users[0].update({
                isAdmin: false,
            });
        });

        test("should not allow editing to add admin reports without permissions", async () => {
            await using client = await generateClient(users[0]);

            await PushSubscription.insert({
                id: randomUUIDv7(),
                endpoint: "https://example.com",
                alerts: {
                    update: true,
                    "admin.report": false,
                    "admin.sign_up": false,
                    favourite: false,
                    follow: false,
                    follow_request: false,
                    mention: false,
                    poll: false,
                    reblog: false,
                    status: false,
                },
                policy: "all",
                authSecret: "test",
                publicKey: "test",
                tokenId: client.dbToken.id,
            });

            const { ok, data } = await client.updatePushSubscription(
                {
                    alerts: {
                        "admin.report": true,
                    },
                },
                "all",
            );

            expect(ok).toBe(true);
            expect(data.alerts).toMatchObject({
                "admin.report": false,
            });
        });

        test("should allow editing to add admin reports with permissions", async () => {
            await users[0].update({
                isAdmin: true,
            });

            await using client = await generateClient(users[0]);

            await PushSubscription.insert({
                id: randomUUIDv7(),
                endpoint: "https://example.com",
                alerts: {
                    update: true,
                    "admin.report": false,
                    "admin.sign_up": false,
                    favourite: false,
                    follow: false,
                    follow_request: false,
                    mention: false,
                    poll: false,
                    reblog: false,
                    status: false,
                },
                policy: "all",
                authSecret: "test",
                publicKey: "test",
                tokenId: client.dbToken.id,
            });

            const { ok, data } = await client.updatePushSubscription(
                {
                    alerts: {
                        "admin.report": true,
                    },
                },
                "all",
            );

            expect(ok).toBe(true);
            expect(data.alerts).toMatchObject({
                update: true,
                "admin.report": true,
                "admin.sign_up": false,
                favourite: false,
                follow: false,
                follow_request: false,
                mention: false,
                poll: false,
                reblog: false,
                status: false,
            });

            await users[0].update({
                isAdmin: false,
            });
        });
    });
});
