import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { config } from "config-manager";
import { ADMIN_ROLES, DEFAULT_ROLES, RolePermissions } from "~/drizzle/schema";
import { Role } from "~/packages/database-interface/role";
import { getTestUsers, sendTestRequest } from "~/tests/utils";
import { meta } from "./index";

const { users, tokens, deleteUsers } = await getTestUsers(1);
let role: Role;
let roleNotLinked: Role;
let higherPriorityRole: Role;

beforeAll(async () => {
    // Create new role
    role = await Role.insert({
        name: "test",
        permissions: DEFAULT_ROLES,
        priority: 2,
        description: "test",
        visible: true,
        icon: "test",
    });

    expect(role).toBeDefined();

    // Link role to user
    await role.linkUser(users[0].id);

    // Create new role
    roleNotLinked = await Role.insert({
        name: "test2",
        permissions: ADMIN_ROLES,
        priority: 0,
        description: "test2",
        visible: true,
        icon: "test2",
    });

    expect(roleNotLinked).toBeDefined();

    // Create a role with higher priority than the user's role
    higherPriorityRole = await Role.insert({
        name: "higherPriorityRole",
        permissions: DEFAULT_ROLES,
        priority: 3, // Higher priority than the user's role
        description: "Higher priority role",
        visible: true,
        icon: "higherPriorityRole",
    });

    expect(higherPriorityRole).toBeDefined();
});

afterAll(async () => {
    await role.delete();
    await roleNotLinked.delete();
    await higherPriorityRole.delete();
    await deleteUsers();
});

// /api/v1/roles/:id
describe(meta.route, () => {
    test("should return 401 if not authenticated", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(
                    meta.route.replace(":id", role.id),
                    config.http.base_url,
                ),
                {
                    method: "GET",
                },
            ),
        );

        expect(response.status).toBe(401);
    });

    test("should return 404 if role does not exist", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(
                    meta.route.replace(
                        ":id",
                        "00000000-0000-0000-0000-000000000000",
                    ),
                    config.http.base_url,
                ),
                {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                    },
                },
            ),
        );

        expect(response.status).toBe(404);
    });

    test("should return the role", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(
                    meta.route.replace(":id", role.id),
                    config.http.base_url,
                ),
                {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                    },
                },
            ),
        );

        expect(response.ok).toBe(true);
        const output = await response.json();
        expect(output).toMatchObject({
            name: "test",
            permissions: DEFAULT_ROLES,
            priority: 2,
            description: "test",
            visible: true,
            icon: expect.any(String),
        });
    });

    test("should return 403 if user does not have MANAGE_ROLES permission", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(
                    meta.route.replace(":id", roleNotLinked.id),
                    config.http.base_url,
                ),
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                    },
                },
            ),
        );

        expect(response.status).toBe(403);
        const output = await response.json();
        expect(output).toMatchObject({
            error: "You do not have the required permissions to access this route. Missing: roles",
        });
    });

    test("should assign new role", async () => {
        await role.update({
            permissions: [RolePermissions.ManageRoles],
        });

        const response = await sendTestRequest(
            new Request(
                new URL(
                    meta.route.replace(":id", roleNotLinked.id),
                    config.http.base_url,
                ),
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                    },
                },
            ),
        );

        expect(response.status).toBe(204);

        // Check if role was assigned
        const response2 = await sendTestRequest(
            new Request(new URL("/api/v1/roles", config.http.base_url), {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
            }),
        );

        expect(response2.ok).toBe(true);
        const roles = await response2.json();
        // The default role will still be there
        expect(roles).toHaveLength(3);
        expect(roles).toContainEqual({
            id: roleNotLinked.id,
            name: "test2",
            permissions: ADMIN_ROLES,
            priority: 0,
            description: "test2",
            visible: true,
            icon: expect.any(String),
        });

        await role.update({
            permissions: [],
        });
    });

    test("should unassign role", async () => {
        const response = await sendTestRequest(
            new Request(
                new URL(
                    meta.route.replace(":id", role.id),
                    config.http.base_url,
                ),
                {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                    },
                },
            ),
        );

        expect(response.status).toBe(204);

        // Check if role was unassigned
        const response2 = await sendTestRequest(
            new Request(new URL("/api/v1/roles", config.http.base_url), {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
            }),
        );

        expect(response2.ok).toBe(true);
        const roles = await response2.json();
        // The default role will still be there
        expect(roles).toHaveLength(2);
        expect(roles).not.toContainEqual({
            name: "test",
            permissions: ADMIN_ROLES,
            priority: 0,
            description: "test",
            visible: true,
            icon: "test",
        });
    });

    test("should return 403 if user tries to add role with higher priority", async () => {
        // Add MANAGE_ROLES permission to user
        await role.update({
            permissions: [RolePermissions.ManageRoles],
        });

        const response = await sendTestRequest(
            new Request(
                new URL(
                    meta.route.replace(":id", higherPriorityRole.id),
                    config.http.base_url,
                ),
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${tokens[0].accessToken}`,
                    },
                },
            ),
        );

        expect(response.status).toBe(403);
        const output = await response.json();
        expect(output).toMatchObject({
            error: "Cannot assign role 'higherPriorityRole' with priority 3 to user with highest role priority 0",
        });

        await role.update({
            permissions: [],
        });
    });
});
