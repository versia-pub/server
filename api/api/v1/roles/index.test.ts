import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Role } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { config } from "~/packages/config-manager/index.ts";
import { fakeRequest, getTestUsers } from "~/tests/utils";

const { users, deleteUsers, tokens } = await getTestUsers(1);
let role: Role;

beforeAll(async () => {
    // Create new role
    role = await Role.insert({
        name: "test",
        permissions: [RolePermissions.ManageRoles],
        priority: 10,
        description: "test",
        visible: true,
        icon: "https://test.com",
    });

    expect(role).toBeDefined();

    // Link role to user
    await role.linkUser(users[0].id);
});

afterAll(async () => {
    await deleteUsers();
    await role.delete();
});

// /api/v1/roles
describe("/api/v1/roles", () => {
    test("should return 401 if not authenticated", async () => {
        const response = await fakeRequest("/api/v1/roles", {
            method: "GET",
        });

        expect(response.status).toBe(401);
    });

    test("should return a list of roles", async () => {
        const response = await fakeRequest("/api/v1/roles", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
            },
        });

        expect(response.ok).toBe(true);
        const roles = await response.json();
        expect(roles).toContainEqual({
            name: "test",
            permissions: [RolePermissions.ManageRoles],
            priority: 10,
            description: "test",
            visible: true,
            icon: expect.any(String),
            id: role.id,
        });

        expect(roles).toContainEqual({
            id: "default",
            name: "Default",
            permissions: config.permissions.default,
            priority: 0,
            description: "Default role for all users",
            visible: false,
        });
    });

    test("should create a new role", async () => {
        const response = await fakeRequest("/api/v1/roles", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: "newRole",
                permissions: [RolePermissions.ManageRoles],
                priority: 1,
                description: "newRole",
                visible: true,
                icon: "https://example.com/icon.png",
            }),
        });

        expect(response.ok).toBe(true);
        const newRole = await response.json();
        expect(newRole).toMatchObject({
            name: "newRole",
            permissions: [RolePermissions.ManageRoles],
            priority: 1,
            description: "newRole",
            visible: true,
            icon: expect.any(String),
        });

        // Cleanup
        const createdRole = await Role.fromId(newRole.id);

        expect(createdRole).toBeDefined();

        await createdRole?.delete();
    });

    test("should return 403 if user tries to create a role with higher priority", async () => {
        const response = await fakeRequest("/api/v1/roles", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: "newRole",
                permissions: [RolePermissions.ManageBlocks],
                priority: 11,
                description: "newRole",
                visible: true,
                icon: "https://example.com/icon.png",
            }),
        });

        expect(response.status).toBe(403);
        const output = await response.json();
        expect(output).toMatchObject({
            error: "Cannot create role with higher priority than your own",
        });
    });

    test("should return 403 if user tries to create a role with permissions they do not have", async () => {
        const response = await fakeRequest("/api/v1/roles", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: "newRole",
                permissions: [RolePermissions.Impersonate],
                priority: 1,
                description: "newRole",
                visible: true,
                icon: "https://example.com/icon.png",
            }),
        });

        expect(response.status).toBe(403);
        const output = await response.json();
        expect(output).toMatchObject({
            error: "Cannot create role with permissions you do not have",
            details: "Forbidden permissions: impersonate",
        });
    });
});
