import { afterAll, describe, expect, test } from "bun:test";
import { config } from "config-manager";
import {
    deleteOldTestUsers,
    getTestUsers,
    sendTestRequest,
} from "~tests/utils";
import type { Status as APIStatus } from "~types/mastodon/status";
import { meta } from "./index";

await deleteOldTestUsers();

const { users, tokens, deleteUsers } = await getTestUsers(5);

afterAll(async () => {
    await deleteUsers();
});

const getFormData = (object: Record<string, string | number | boolean>) =>
    Object.keys(object).reduce((formData, key) => {
        formData.append(key, String(object[key]));
        return formData;
    }, new FormData());

describe(meta.route, () => {
    test("should return 401 if not authenticated", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                body: new URLSearchParams(),
            }),
        );

        expect(response.status).toBe(401);
    });

    test("should return 422 is status is empty", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
                body: new URLSearchParams(),
            }),
        );

        expect(response.status).toBe(422);
    });

    test("should return 422 is status is too long", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
                body: new URLSearchParams({
                    status: "a".repeat(config.validation.max_note_size + 1),
                    federate: "false",
                }),
            }),
        );

        expect(response.status).toBe(422);
    });

    test("should return 422 is visibility is invalid", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
                body: new URLSearchParams({
                    status: "Hello, world!",
                    visibility: "invalid",
                    federate: "false",
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
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
                body: new URLSearchParams({
                    status: "Hello, world!",
                    scheduled_at: "invalid",
                    federate: "false",
                }),
            }),
        );

        expect(response.status).toBe(422);
    });

    test("should return 422 is in_reply_to_id is invalid", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
                body: new URLSearchParams({
                    status: "Hello, world!",
                    in_reply_to_id: "invalid",
                    federate: "false",
                }),
            }),
        );

        expect(response.status).toBe(422);
    });

    test("should return 422 is quote_id is invalid", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
                body: new URLSearchParams({
                    status: "Hello, world!",
                    quote_id: "invalid",
                    federate: "false",
                }),
            }),
        );

        expect(response.status).toBe(422);
    });

    test("should return 422 is media_ids is invalid", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
                body: new URLSearchParams({
                    status: "Hello, world!",
                    "media_ids[]": "invalid",
                    federate: "false",
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
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
                body: new URLSearchParams({
                    status: "Hello, world!",
                    federate: "false",
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
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
                body: new URLSearchParams({
                    status: "Hello, world!",
                    visibility: "unlisted",
                    federate: "false",
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
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
                body: new URLSearchParams({
                    status: "Hello, world!",
                    federate: "false",
                }),
            }),
        );

        const object = (await response.json()) as APIStatus;

        const response2 = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
                body: new URLSearchParams({
                    status: "Hello, world again!",
                    in_reply_to_id: object.id,
                    federate: "false",
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
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
                body: new URLSearchParams({
                    status: "Hello, world!",
                    federate: "false",
                }),
            }),
        );

        const object = (await response.json()) as APIStatus;

        const response2 = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
                body: new URLSearchParams({
                    status: "Hello, world again!",
                    quote_id: object.id,
                    federate: "false",
                }),
            }),
        );

        expect(response2.status).toBe(200);
        expect(response2.headers.get("content-type")).toBe("application/json");

        const object2 = (await response2.json()) as APIStatus;

        expect(object2.content).toBe("<p>Hello, world again!</p>");
        // @ts-expect-error Pleroma extension
        expect(object2.quote_id).toBe(object.id);
        // @ts-expect-error Glitch SOC extension
        expect(object2.quote?.id).toBe(object.id);
    });

    describe("mentions testing", () => {
        test("should correctly parse @mentions", async () => {
            const response = await sendTestRequest(
                new Request(new URL(meta.route, config.http.base_url), {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                    },
                    body: new URLSearchParams({
                        status: `Hello, @${users[1].getUser().username}!`,
                        federate: "false",
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
                username: users[1].getUser().username,
                acct: users[1].getUser().username,
            });
        });

        test("should correctly parse @mentions@domain", async () => {
            const response = await sendTestRequest(
                new Request(new URL(meta.route, config.http.base_url), {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                    },
                    body: new URLSearchParams({
                        status: `Hello, @${users[1].getUser().username}@${
                            new URL(config.http.base_url).host
                        }!`,
                        federate: "false",
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
                username: users[1].getUser().username,
                acct: users[1].getUser().username,
            });
        });
    });

    describe("HTML injection testing", () => {
        test("should not allow HTML injection", async () => {
            const response = await sendTestRequest(
                new Request(new URL(meta.route, config.http.base_url), {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                    },
                    body: new URLSearchParams({
                        status: "Hi! <script>alert('Hello, world!');</script>",
                        federate: "false",
                    }),
                }),
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toBe(
                "application/json",
            );

            const object = (await response.json()) as APIStatus;

            expect(object.content).toBe(
                "<p>Hi! &lt;script&gt;alert('Hello, world!');&lt;/script&gt;</p>",
            );
        });

        test("should not allow HTML injection in spoiler_text", async () => {
            const response = await sendTestRequest(
                new Request(new URL(meta.route, config.http.base_url), {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                    },
                    body: new URLSearchParams({
                        status: "Hello, world!",
                        spoiler_text:
                            "uwu <script>alert('Hello, world!');</script>",
                        federate: "false",
                    }),
                }),
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toBe(
                "application/json",
            );

            const object = (await response.json()) as APIStatus;

            expect(object.spoiler_text).toBe(
                "uwu &#x3C;script&#x3E;alert(&#x27;Hello, world!&#x27;);&#x3C;/script&#x3E;",
            );
        });
    });
});
