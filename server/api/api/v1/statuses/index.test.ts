import { afterAll, describe, expect, test } from "bun:test";
import { config } from "~index";
import {
    deleteOldTestUsers,
    getTestUsers,
    sendTestRequest,
} from "~tests/utils";
import type { APIStatus } from "~types/entities/status";
import { meta } from "./index";

await deleteOldTestUsers();

const { users, tokens, deleteUsers } = await getTestUsers(5);

afterAll(async () => {
    await deleteUsers();
});

describe(meta.route, () => {
    test("should return 405 if method is not allowed", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "GET",
            }),
        );

        expect(response.status).toBe(405);
    });

    test("should return 401 if not authenticated", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
            }),
        );

        expect(response.status).toBe(401);
    });

    test("should return 422 is status is empty", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
                body: JSON.stringify({}),
            }),
        );

        expect(response.status).toBe(422);
    });

    test("should return 400 is status is too long", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
                body: JSON.stringify({
                    status: "a".repeat(config.validation.max_note_size + 1),
                    federate: false,
                }),
            }),
        );

        expect(response.status).toBe(400);
    });

    test("should return 422 is visibility is invalid", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
                body: JSON.stringify({
                    status: "Hello, world!",
                    visibility: "invalid",
                    federate: false,
                }),
            }),
        );

        expect(response.status).toBe(422);
    });

    test("should return 422 if scheduled_at is invalid", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
                body: JSON.stringify({
                    status: "Hello, world!",
                    scheduled_at: "invalid",
                    federate: false,
                }),
            }),
        );

        expect(response.status).toBe(422);
    });

    test("should return 404 is in_reply_to_id is invalid", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
                body: JSON.stringify({
                    status: "Hello, world!",
                    in_reply_to_id: "invalid",
                    federate: false,
                }),
            }),
        );

        expect(response.status).toBe(404);
    });

    test("should return 404 is quote_id is invalid", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
                body: JSON.stringify({
                    status: "Hello, world!",
                    quote_id: "invalid",
                    federate: false,
                }),
            }),
        );

        expect(response.status).toBe(404);
    });

    test("should return 422 is media_ids is invalid", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
                body: JSON.stringify({
                    status: "Hello, world!",
                    media_ids: ["invalid"],
                    federate: false,
                }),
            }),
        );

        expect(response.status).toBe(422);
    });

    test("should create a post", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
                body: JSON.stringify({
                    status: "Hello, world!",
                    federate: false,
                }),
            }),
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("application/json");

        const object = (await response.json()) as APIStatus;

        expect(object.content).toBe("<p>Hello, world!</p>");
    });

    test("should create a post with visibility", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
                body: JSON.stringify({
                    status: "Hello, world!",
                    visibility: "unlisted",
                    federate: false,
                }),
            }),
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("application/json");

        const object = (await response.json()) as APIStatus;

        expect(object.content).toBe("<p>Hello, world!</p>");
        expect(object.visibility).toBe("unlisted");
    });

    test("should create a post with a reply", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
                body: JSON.stringify({
                    status: "Hello, world!",
                    federate: false,
                }),
            }),
        );

        const object = (await response.json()) as APIStatus;

        const response2 = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
                body: JSON.stringify({
                    status: "Hello, world again!",
                    in_reply_to_id: object.id,
                    federate: false,
                }),
            }),
        );

        expect(response2.status).toBe(200);
        expect(response2.headers.get("content-type")).toBe("application/json");

        const object2 = (await response2.json()) as APIStatus;

        expect(object2.content).toBe("<p>Hello, world again!</p>");
        expect(object2.in_reply_to_id).toBe(object.id);
    });

    test("should create a post with a quote", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
                body: JSON.stringify({
                    status: "Hello, world!",
                    federate: false,
                }),
            }),
        );

        const object = (await response.json()) as APIStatus;

        const response2 = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
                body: JSON.stringify({
                    status: "Hello, world again!",
                    quote_id: object.id,
                    federate: false,
                }),
            }),
        );

        expect(response2.status).toBe(200);
        expect(response2.headers.get("content-type")).toBe("application/json");

        const object2 = (await response2.json()) as APIStatus;

        expect(object2.content).toBe("<p>Hello, world again!</p>");
        expect(object2.quote_id).toBe(object.id);
    });

    describe("mentions testing", () => {
        test("should correctly parse @mentions", async () => {
            const response = await sendTestRequest(
                new Request(new URL(meta.route, config.http.base_url), {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                    },
                    body: JSON.stringify({
                        status: `Hello, @${users[1].username}!`,
                        federate: false,
                    }),
                }),
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toBe(
                "application/json",
            );

            const object = (await response.json()) as APIStatus;

            expect(object.mentions).toBeArrayOfSize(1);
            expect(object.mentions[0]).toMatchObject({
                id: users[1].id,
                username: users[1].username,
                acct: users[1].username,
            });
        });

        test("should correctly parse @mentions@domain", async () => {
            const response = await sendTestRequest(
                new Request(new URL(meta.route, config.http.base_url), {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                    },
                    body: JSON.stringify({
                        status: `Hello, @${users[1].username}@${
                            new URL(config.http.base_url).host
                        }!`,
                        federate: false,
                    }),
                }),
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toBe(
                "application/json",
            );

            const object = (await response.json()) as APIStatus;

            expect(object.mentions).toBeArrayOfSize(1);
            expect(object.mentions[0]).toMatchObject({
                id: users[1].id,
                username: users[1].username,
                acct: users[1].username,
            });
        });
    });
});
