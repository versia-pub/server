import { afterAll, describe, expect, test } from "bun:test";
import { generateClient, getTestUsers } from "@versia-server/tests";

const { users, deleteUsers } = await getTestUsers(5);

afterAll(async () => {
    await deleteUsers();
});

// /api/v1/accounts/search
describe("/api/v1/accounts/search", () => {
    test("should return 200 with users", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok } = await client.searchAccount(users[0].data.username);

        expect(ok).toBe(true);
        expect(data).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: users[0].id,
                    username: users[0].data.username,
                    display_name: users[0].data.displayName,
                    avatar: expect.any(String),
                    header: expect.any(String),
                }),
            ]),
        );
    });
});
