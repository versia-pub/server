import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { RolePermission } from "@versia/client/schemas";
import { Role } from "@versia/kit/db";
import { generateClient, getTestUsers } from "@versia-server/tests";
import { randomUUIDv7 } from "bun";

const { users, deleteUsers } = await getTestUsers(2);
let role: Role;

beforeAll(async () => {
    // Create new role
    role = await Role.insert({
        id: randomUUIDv7(),
        name: "test",
        permissions: [RolePermission.ManageRoles],
        priority: 2,
        description: "test",
        visible: true,
        icon: "https://test.com",
    });

    expect(role).toBeDefined();

    await role.linkUser(users[0].id);
});

afterAll(async () => {
    await role.delete();
    await deleteUsers();
});

describe("/api/v1/accounts/:id/roles", () => {
    test("should return 404 if user does not exist", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok, raw } = await client.getAccountRoles(
            "00000000-0000-0000-0000-000000000000",
        );

        expect(ok).toBe(false);
        expect(raw.status).toBe(404);
        expect(data).toMatchObject({
            error: "User not found",
        });
    });

    test("should return a list of roles for the user", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok } = await client.getAccountRoles(users[0].id);

        expect(ok).toBe(true);
        expect(data).toBeArray();
        expect(data).toContainEqual({
            id: role.id,
            name: "test",
            permissions: [RolePermission.ManageRoles],
            priority: 2,
            description: "test",
            visible: true,
            icon: expect.any(String),
        });
    });
});
