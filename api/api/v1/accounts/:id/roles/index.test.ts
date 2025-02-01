import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Role } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { fakeRequest, getTestUsers } from "~/tests/utils";

const { users, tokens, deleteUsers } = await getTestUsers(2);
let role: Role;

beforeAll(async () => {
    // Create new role
    role = await Role.insert({
        name: "test",
        permissions: [RolePermissions.ManageRoles],
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
        const response = await fakeRequest(
            "/api/v1/accounts/00000000-0000-0000-0000-000000000000/roles",
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
            },
        );

        expect(response.status).toBe(404);
        const output = await response.json();
        expect(output).toMatchObject({
            error: "User not found",
        });
    });

    test("should return a list of roles for the user", async () => {
        const response = await fakeRequest(
            `/api/v1/accounts/${users[0].id}/roles`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
            },
        );

        expect(response.ok).toBe(true);
        const roles = await response.json();
        expect(roles).toContainEqual({
            id: role.id,
            name: "test",
            permissions: [RolePermissions.ManageRoles],
            priority: 2,
            description: "test",
            visible: true,
            icon: expect.any(String),
        });
    });
});
