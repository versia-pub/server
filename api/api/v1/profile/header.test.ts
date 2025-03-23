import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { generateClient, getTestUsers } from "~/tests/utils";

const { users, deleteUsers } = await getTestUsers(3);

let headerUrl: string;

beforeAll(async () => {
    await using client = await generateClient(users[0]);

    const { ok, data } = await client.updateCredentials({
        header: new URL("https://placehold.co/100x100"),
    });

    expect(ok).toBe(true);

    headerUrl = data.header;
});

afterAll(async () => {
    await deleteUsers();
});
describe("POST /api/v1/profile/header", () => {
    test("should return 401 if not authenticated", async () => {
        await using client = await generateClient();

        const { ok, raw } = await client.deleteHeader();

        expect(ok).toBe(false);
        expect(raw.status).toBe(401);
    });

    test("should delete header", async () => {
        await using client = await generateClient(users[0]);

        const { ok, data } = await client.deleteHeader();

        expect(ok).toBe(true);
        expect(data.header).not.toBe(headerUrl);
    });
});
