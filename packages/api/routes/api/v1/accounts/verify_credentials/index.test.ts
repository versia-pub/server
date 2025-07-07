import { afterAll, describe, expect, test } from "bun:test";
import { config } from "@versia-server/config";
import { generateClient, getTestUsers } from "@versia-server/tests";

const { users, deleteUsers } = await getTestUsers(1);

afterAll(async () => {
    await deleteUsers();
});

describe("/api/v1/accounts/verify_credentials", () => {
    describe("Authentication", () => {
        test("should return 401 when not authenticated", async () => {
            await using client = await generateClient();

            const { ok, raw } = await client.verifyAccountCredentials();

            expect(ok).toBe(false);
            expect(raw.status).toBe(401);
        });

        test("should return user data when authenticated", async () => {
            await using client = await generateClient(users[0]);

            const { ok, data } = await client.verifyAccountCredentials();

            expect(ok).toBe(true);
            expect(data.id).toBe(users[0].id);
            expect(data.username).toBe(users[0].data.username);
            expect(data.acct).toBe(users[0].data.username);
            expect(data.display_name).toBe(users[0].data.displayName ?? "");
            expect(data.note).toBe(users[0].data.note);
            expect(data.url).toBe(
                new URL(
                    `/@${users[0].data.username}`,
                    config.http.base_url,
                ).toString(),
            );
            expect(data.avatar).toBeDefined();
            expect(data.avatar_static).toBeDefined();
            expect(data.header).toBeDefined();
            expect(data.header_static).toBeDefined();
            expect(data.locked).toBe(users[0].data.isLocked);
            expect(data.bot).toBe(users[0].data.isBot);
            expect(data.group).toBe(false);
            expect(data.discoverable).toBe(users[0].data.isDiscoverable);
            expect(data.noindex).toBe(!users[0].data.isIndexable);
            expect(data.moved).toBeNull();
            expect(data.suspended).toBe(false);
            expect(data.limited).toBe(false);
            expect(data.created_at).toBe(
                new Date(users[0].data.createdAt).toISOString(),
            );
            expect(data.last_status_at).toBeNull();
            expect(data.statuses_count).toBe(0);
            expect(data.followers_count).toBe(0);
            expect(data.following_count).toBe(0);
        });
    });
});
