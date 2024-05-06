import { afterAll, describe, expect, test } from "bun:test";
import { config } from "config-manager";
import { getTestUsers, sendTestRequest, wrapRelativeUrl } from "~tests/utils";
import type { AsyncAttachment as APIAsyncAttachment } from "~types/mastodon/async_attachment";
import type { Context as APIContext } from "~types/mastodon/context";
import type { Status as APIStatus } from "~types/mastodon/status";

const base_url = config.http.base_url;

const { users, tokens, deleteUsers } = await getTestUsers(1);
const user = users[0];
const token = tokens[0];
let status: APIStatus | null = null;
let status2: APIStatus | null = null;
let media1: APIAsyncAttachment | null = null;

describe("API Tests", () => {
    afterAll(async () => {
        await deleteUsers();
    });

    describe("POST /api/v2/media", () => {
        test("should upload a file and return a MediaAttachment object", async () => {
            const formData = new FormData();
            formData.append("file", new Blob(["test"], { type: "text/plain" }));

            const response = await sendTestRequest(
                new Request(
                    wrapRelativeUrl(`${base_url}/api/v2/media`, base_url),
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${token.accessToken}`,
                        },
                        body: formData,
                    },
                ),
            );

            expect(response.status).toBe(202);
            expect(response.headers.get("content-type")).toBe(
                "application/json",
            );

            media1 = (await response.json()) as APIAsyncAttachment;

            expect(media1.id).toBeDefined();
            expect(media1.type).toBe("unknown");
            expect(media1.url).toBeDefined();
        });
    });

    describe("POST /api/v1/statuses", () => {
        test("should create a new status and return an APIStatus object", async () => {
            const response = await sendTestRequest(
                new Request(
                    wrapRelativeUrl(`${base_url}/api/v1/statuses`, base_url),
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${token.accessToken}`,
                        },
                        body: new URLSearchParams({
                            status: "Hello, world!",
                            visibility: "public",
                            "media_ids[]": media1?.id ?? "",
                            federate: "false",
                        }),
                    },
                ),
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toBe(
                "application/json",
            );

            status = (await response.json()) as APIStatus;
            expect(status.content).toContain("Hello, world!");
            expect(status.visibility).toBe("public");
            expect(status.account.id).toBe(user.id);
            expect(status.replies_count).toBe(0);
            expect(status.favourites_count).toBe(0);
            expect(status.reblogged).toBe(false);
            expect(status.favourited).toBe(false);
            expect(status.media_attachments).toBeArrayOfSize(1);
            expect(status.mentions).toEqual([]);
            expect(status.tags).toEqual([]);
            expect(status.sensitive).toBe(false);
            expect(status.spoiler_text).toBe("");
            expect(status.language).toBeNull();
            expect(status.pinned).toBe(false);
            expect(status.visibility).toBe("public");
            expect(status.card).toBeNull();
            expect(status.poll).toBeNull();
            expect(status.emojis).toEqual([]);
            expect(status.in_reply_to_id).toBeNull();
            expect(status.in_reply_to_account_id).toBeNull();
        });

        test("should create a new status in reply to the previous one", async () => {
            const response = await sendTestRequest(
                new Request(
                    wrapRelativeUrl(`${base_url}/api/v1/statuses`, base_url),
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${token.accessToken}`,
                        },
                        body: new URLSearchParams({
                            status: "This is a reply!",
                            visibility: "public",
                            in_reply_to_id: status?.id ?? "",
                            federate: "false",
                        }),
                    },
                ),
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toBe(
                "application/json",
            );

            status2 = (await response.json()) as APIStatus;
            expect(status2.content).toContain("This is a reply!");
            expect(status2.visibility).toBe("public");
            expect(status2.account.id).toBe(user.id);
            expect(status2.replies_count).toBe(0);
            expect(status2.favourites_count).toBe(0);
            expect(status2.reblogged).toBe(false);
            expect(status2.favourited).toBe(false);
            expect(status2.media_attachments).toEqual([]);
            expect(status2.mentions).toEqual([]);
            expect(status2.tags).toEqual([]);
            expect(status2.sensitive).toBe(false);
            expect(status2.spoiler_text).toBe("");
            expect(status2.language).toBeNull();
            expect(status2.pinned).toBe(false);
            expect(status2.visibility).toBe("public");
            expect(status2.card).toBeNull();
            expect(status2.poll).toBeNull();
            expect(status2.emojis).toEqual([]);
            expect(status2.in_reply_to_id).toEqual(status?.id || null);
            expect(status2.in_reply_to_account_id).toEqual(user.id);
        });
    });

    describe("GET /api/v1/statuses/:id", () => {
        test("should return the specified status object", async () => {
            const response = await sendTestRequest(
                new Request(
                    wrapRelativeUrl(
                        `${base_url}/api/v1/statuses/${status?.id}`,
                        base_url,
                    ),
                    {
                        headers: {
                            Authorization: `Bearer ${token.accessToken}`,
                        },
                    },
                ),
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toBe(
                "application/json",
            );

            const statusJson = (await response.json()) as APIStatus;

            expect(statusJson.id).toBe(status?.id || "");
            expect(statusJson.content).toBeDefined();
            expect(statusJson.created_at).toBeDefined();
            expect(statusJson.account).toBeDefined();
            expect(statusJson.reblog).toBeDefined();
            expect(statusJson.application).toBeDefined();
            expect(statusJson.emojis).toBeDefined();
            expect(statusJson.media_attachments).toBeDefined();
            expect(statusJson.poll).toBeDefined();
            expect(statusJson.card).toBeDefined();
            expect(statusJson.visibility).toBeDefined();
            expect(statusJson.sensitive).toBeDefined();
            expect(statusJson.spoiler_text).toBeDefined();
            expect(statusJson.uri).toBeDefined();
            expect(statusJson.url).toBeDefined();
            expect(statusJson.replies_count).toBeDefined();
            expect(statusJson.reblogs_count).toBeDefined();
            expect(statusJson.favourites_count).toBeDefined();
            expect(statusJson.favourited).toBeDefined();
            expect(statusJson.reblogged).toBeDefined();
            expect(statusJson.muted).toBeDefined();
            expect(statusJson.bookmarked).toBeDefined();
            expect(statusJson.pinned).toBeDefined();
        });
    });

    describe("POST /api/v1/statuses/:id/reblog", () => {
        test("should reblog the specified status and return the reblogged status object", async () => {
            const response = await sendTestRequest(
                new Request(
                    wrapRelativeUrl(
                        `${base_url}/api/v1/statuses/${status?.id}/reblog`,
                        base_url,
                    ),
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${token.accessToken}`,
                        },
                    },
                ),
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toBe(
                "application/json",
            );

            const rebloggedStatus = (await response.json()) as APIStatus;

            expect(rebloggedStatus.id).toBeDefined();
            expect(rebloggedStatus.reblog?.id).toEqual(status?.id ?? "");
            expect(rebloggedStatus.reblog?.reblogged).toBe(true);
        });
    });

    describe("POST /api/v1/statuses/:id/unreblog", () => {
        test("should unreblog the specified status and return the original status object", async () => {
            const response = await sendTestRequest(
                new Request(
                    wrapRelativeUrl(
                        `${base_url}/api/v1/statuses/${status?.id}/unreblog`,
                        base_url,
                    ),
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${token.accessToken}`,
                        },
                    },
                ),
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toBe(
                "application/json",
            );

            const unrebloggedStatus = (await response.json()) as APIStatus;

            expect(unrebloggedStatus.id).toBeDefined();
            expect(unrebloggedStatus.reblogged).toBe(false);
        });
    });

    describe("GET /api/v1/statuses/:id/context", () => {
        test("should return the context of the specified status", async () => {
            const response = await sendTestRequest(
                new Request(
                    wrapRelativeUrl(
                        `${base_url}/api/v1/statuses/${status?.id}/context`,
                        base_url,
                    ),
                    {
                        headers: {
                            Authorization: `Bearer ${token.accessToken}`,
                        },
                    },
                ),
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toBe(
                "application/json",
            );

            const context = (await response.json()) as APIContext;

            expect(context.ancestors.length).toBe(0);
            expect(context.descendants.length).toBe(1);

            // First descendant should be status2
            expect(context.descendants[0].id).toBe(status2?.id || "");
        });
    });

    describe("GET /api/v1/accounts/:id/statuses", () => {
        test("should return the statuses of the specified user", async () => {
            const response = await sendTestRequest(
                new Request(
                    wrapRelativeUrl(
                        `${base_url}/api/v1/accounts/${user.id}/statuses`,
                        base_url,
                    ),
                    {
                        method: "GET",
                        headers: {
                            Authorization: `Bearer ${token.accessToken}`,
                        },
                    },
                ),
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toBe(
                "application/json",
            );

            const statuses = (await response.json()) as APIStatus[];

            expect(statuses.length).toBe(2);

            const status1 = statuses[0];

            // Basic validation
            expect(status1.content).toContain("This is a reply!");
            expect(status1.visibility).toBe("public");
            expect(status1.account.id).toBe(user.id);
        });
    });

    describe("POST /api/v1/statuses/:id/favourite", () => {
        test("should favourite the specified status object", async () => {
            const response = await sendTestRequest(
                new Request(
                    wrapRelativeUrl(
                        `${base_url}/api/v1/statuses/${status?.id}/favourite`,
                        base_url,
                    ),
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${token.accessToken}`,
                        },
                    },
                ),
            );

            expect(response.status).toBe(200);
        });
    });

    describe("POST /api/v1/statuses/:id/unfavourite", () => {
        test("should unfavourite the specified status object", async () => {
            // Unfavourite the status
            const response = await sendTestRequest(
                new Request(
                    wrapRelativeUrl(
                        `${base_url}/api/v1/statuses/${status?.id}/unfavourite`,
                        base_url,
                    ),
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${token.accessToken}`,
                        },
                    },
                ),
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toBe(
                "application/json",
            );

            const updatedStatus = (await response.json()) as APIStatus;

            expect(updatedStatus.favourited).toBe(false);
            expect(updatedStatus.favourites_count).toBe(0);
        });
    });

    describe("DELETE /api/v1/statuses/:id", () => {
        test("should delete the specified status object", async () => {
            const response = await sendTestRequest(
                new Request(
                    wrapRelativeUrl(
                        `${base_url}/api/v1/statuses/${status?.id}`,
                        base_url,
                    ),
                    {
                        method: "DELETE",
                        headers: {
                            Authorization: `Bearer ${token.accessToken}`,
                        },
                    },
                ),
            );

            expect(response.status).toBe(200);
        });
    });
});
