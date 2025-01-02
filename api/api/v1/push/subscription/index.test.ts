import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { PushSubscription } from "@versia/kit/db";
import { fakeRequest, getTestUsers } from "~/tests/utils";

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
        const res = await fakeRequest("/api/v1/push/subscription", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                data: {
                    alerts: {
                        update: true,
                    },
                },
                policy: "all",
                subscription: {
                    endpoint: "https://example.com",
                    keys: {
                        p256dh: "test",
                        auth: "testthatis24charactersha",
                    },
                },
            }),
        });

        expect(res.status).toBe(200);

        const body = await res.json();

        expect(body).toMatchObject({
            endpoint: "https://example.com",
            alerts: {
                update: true,
            },
        });
    });

    test("should retrieve the same push subscription", async () => {
        await PushSubscription.insert({
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
            tokenId: tokens[1].id,
        });

        const res = await fakeRequest("/api/v1/push/subscription", {
            headers: {
                Authorization: `Bearer ${tokens[1].data.accessToken}`,
            },
        });

        expect(res.status).toBe(200);

        const body = await res.json();

        expect(body).toMatchObject({
            endpoint: "https://example.com",
            alerts: {
                update: true,
            },
        });
    });

    test("should update a push subscription", async () => {
        await PushSubscription.insert({
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
            tokenId: tokens[0].id,
        });

        const res = await fakeRequest("/api/v1/push/subscription", {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                data: {
                    alerts: {
                        update: false,
                        favourite: true,
                    },
                },
                policy: "follower",
            }),
        });

        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({
            alerts: {
                update: false,
                favourite: true,
            },
        });
    });

    describe("permissions", () => {
        test("should not allow watching admin reports without permissions", async () => {
            const res = await fakeRequest("/api/v1/push/subscription", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    data: {
                        alerts: {
                            "admin.report": true,
                        },
                    },
                    policy: "all",
                    subscription: {
                        endpoint: "https://example.com",
                        keys: {
                            p256dh: "test",
                            auth: "testthatis24charactersha",
                        },
                    },
                }),
            });

            expect(res.status).toBe(200);
            expect(await res.json()).toMatchObject({
                alerts: {
                    "admin.report": false,
                },
            });
        });

        test("should allow watching admin reports with permissions", async () => {
            await users[0].update({
                isAdmin: true,
            });

            const res = await fakeRequest("/api/v1/push/subscription", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    data: {
                        alerts: {
                            "admin.report": true,
                        },
                    },
                    policy: "all",
                    subscription: {
                        endpoint: "https://example.com",
                        keys: {
                            p256dh: "test",
                            auth: "testthatis24charactersha",
                        },
                    },
                }),
            });

            expect(res.status).toBe(200);

            await users[0].update({
                isAdmin: false,
            });
        });

        test("should not allow editing to add admin reports without permissions", async () => {
            await PushSubscription.insert({
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
                tokenId: tokens[0].id,
            });

            const res = await fakeRequest("/api/v1/push/subscription", {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    data: {
                        alerts: {
                            "admin.report": true,
                        },
                    },
                    policy: "all",
                }),
            });

            expect(res.status).toBe(200);
            expect(await res.json()).toMatchObject({
                alerts: {
                    "admin.report": false,
                },
            });
        });

        test("should allow editing to add admin reports with permissions", async () => {
            await users[0].update({
                isAdmin: true,
            });

            await PushSubscription.insert({
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
                tokenId: tokens[0].id,
            });

            const res = await fakeRequest("/api/v1/push/subscription", {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    data: {
                        alerts: {
                            "admin.report": true,
                        },
                    },
                    policy: "all",
                }),
            });

            expect(res.status).toBe(200);
            expect(await res.json()).toMatchObject({
                alerts: {
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
                },
            });

            await users[0].update({
                isAdmin: false,
            });
        });
    });
});
