import { afterAll, describe, expect, test } from "bun:test";
import {
    fakeRequest,
    generateClient,
    getTestUsers,
} from "@versia-server/tests";

let clientId: string;
const { users, passwords, deleteUsers } = await getTestUsers(1);

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

        clientId = data.client_id;
    });

    test("should get a JWT", async () => {
        const formData = new FormData();

        formData.append("identifier", users[0]?.data.email ?? "");
        formData.append("password", passwords[0]);

        const response = await fakeRequest(
            `/api/auth/login?client_id=${clientId}&redirect_uri=https://example.com&response_type=code&scope=read+write`,
            {
                method: "POST",
                body: formData,
            },
        );

        expect(response.status).toBe(302);

        //jwt = response.headers.get("Set-Cookie")?.match(/jwt=([^;]+);/)?.[1] ?? "";
    });

    // TODO: Test full flow including OpenID part
});
