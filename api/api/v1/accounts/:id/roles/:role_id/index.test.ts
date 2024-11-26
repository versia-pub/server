import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Role } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { fakeRequest, getTestUsers } from "~/tests/utils";

const { users, tokens, deleteUsers } = await getTestUsers(2);
let role: Role;
let higherPriorityRole: Role;

beforeAll(async () => {
    // Create new role
    role = await Role.insert({
        name: "test",
        permissions: [RolePermissions.ManageRoles],
        priority: 2,
        description: "test",
        visible: true,
        icon: "test",
    });

    expect(role).toBeDefined();

    await role.linkUser(users[0].id);

    // Create a role with higher priority than the user's role
    higherPriorityRole = await Role.insert({
        name: "higherPriorityRole",
        permissions: [RolePermissions.ManageRoles],
        priority: 3, // Higher priority than the user's role
        description: "Higher priority role",
        visible: true,
        icon: "higherPriorityRole",
    });

    expect(higherPriorityRole).toBeDefined();
});

afterAll(async () => {
    await role.delete();
    await higherPriorityRole.delete();
    await deleteUsers();
});

// /api/v1/accounts/:id/roles/:role_id
describe("/api/v1/accounts/:id/roles/:role_id", () => {
    test("should return 401 if not authenticated", async () => {
        const response = await fakeRequest(
            `/api/v1/accounts/${users[1].id}/roles/${role.id}`,
            {
                method: "POST",
            },
        );

        expect(response.status).toBe(401);
    });

    test("should return 404 if role does not exist", async () => {
        const response = await fakeRequest(
            `/api/v1/accounts/${users[1].id}/roles/00000000-0000-0000-0000-000000000000`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
            },
        );

        expect(response.status).toBe(404);
    });

    test("should return 404 if user does not exist", async () => {
        const response = await fakeRequest(
            `/api/v1/accounts/00000000-0000-0000-0000-000000000000/roles/${role.id}`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
            },
        );

        expect(response.status).toBe(404);
    });

    test("should assign role to user", async () => {
        const response = await fakeRequest(
            `/api/v1/accounts/${users[1].id}/roles/${role.id}`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
            },
        );

        expect(response.status).toBe(204);

        // Check if role was assigned
        const userRoles = await Role.getUserRoles(users[1].id, false);
        expect(userRoles).toContainEqual(
            expect.objectContaining({ id: role.id }),
        );
    });

    test("should return 403 if user tries to assign role with higher priority", async () => {
        const response = await fakeRequest(
            `/api/v1/accounts/${users[1].id}/roles/${higherPriorityRole.id}`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
            },
        );

        expect(response.status).toBe(403);
        const output = await response.json();
        expect(output).toMatchObject({
            error: `Cannot assign role 'higherPriorityRole' with priority 3 to user: your highest role priority is 2`,
        });
    });

    test("should remove role from user", async () => {
        const response = await fakeRequest(
            `/api/v1/accounts/${users[1].id}/roles/${role.id}`,
            {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
            },
        );

        expect(response.status).toBe(204);

        // Check if role was removed
        const userRoles = await Role.getUserRoles(users[1].id, false);
        expect(userRoles).not.toContainEqual(
            expect.objectContaining({ id: role.id }),
        );
    });

    test("should return 403 if user tries to remove role with higher priority", async () => {
        await higherPriorityRole.linkUser(users[1].id);

        const response = await fakeRequest(
            `/api/v1/accounts/${users[1].id}/roles/${higherPriorityRole.id}`,
            {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
            },
        );

        expect(response.status).toBe(403);
        const output = await response.json();
        expect(output).toMatchObject({
            error: `Cannot remove role 'higherPriorityRole' with priority 3 from user: your highest role priority is 2`,
        });

        await higherPriorityRole.unlinkUser(users[1].id);
    });
});
