import { afterAll, describe, expect, test } from "bun:test";
import { generateClient, getTestUsers } from "@versia-server/tests";

const { users, deleteUsers } = await getTestUsers(1);

afterAll(async () => {
    await deleteUsers();
});

describe("Login flow", () => {
    test("should create a client", async () => {
        const client = await generateClient(users[0]);

        const { ok, data } = await client.createApp("Test Client", {
            redirect_uris: "https://example.com",
            website: "https://example.com",
            scopes: ["read", "write"],
        });

        expect(ok).toBe(true);
        expect(data).toEqual({
            name: "Test Client",
            website: "https://example.com",
            client_id: expect.any(String),
            client_secret: expect.any(String),
            client_secret_expires_at: "0",
            redirect_uri: "https://example.com",
            redirect_uris: ["https://example.com"],
            scopes: ["read", "write"],
        });
    });

    // TODO: Test full flow including OpenID part
});
