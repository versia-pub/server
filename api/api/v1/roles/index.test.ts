import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { RolePermission } from "@versia/client/schemas";
import { Role } from "@versia/kit/db";
import { config } from "~/config.ts";
import { generateClient, getTestUsers } from "~/tests/utils";

const { users, deleteUsers } = await getTestUsers(1);
let role: Role;

beforeAll(async () => {
    // Create new role
    role = await Role.insert({
        name: "test",
        permissions: [RolePermission.ManageRoles],
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
        await using client = await generateClient();

        const { ok, raw } = await client.getRoles();

        expect(ok).toBe(false);
        expect(raw.status).toBe(401);
    });

    test("should return a list of roles", async () => {
        await using client = await generateClient(users[0]);

        const { ok, data } = await client.getRoles();

        expect(ok).toBe(true);
        expect(data).toContainEqual({
            name: "test",
            permissions: [RolePermission.ManageRoles],
            priority: 10,
            description: "test",
            visible: true,
            icon: expect.any(String),
            id: role.id,
        });

        expect(data).toContainEqual({
            id: "default",
            name: "Default",
            permissions: config.permissions.default,
            priority: 0,
            description: "Default role for all users",
            visible: false,
        });
    });

    test("should create a new role", async () => {
        await using client = await generateClient(users[0]);

        const { ok, data } = await client.createRole("newRole", {
            permissions: [RolePermission.ManageRoles],
            priority: 1,
            description: "newRole",
            visible: true,
            icon: "https://example.com/icon.png",
        });

        expect(ok).toBe(true);
        expect(data).toMatchObject({
            name: "newRole",
            permissions: [RolePermission.ManageRoles],
            priority: 1,
            description: "newRole",
            visible: true,
            icon: expect.any(String),
        });

        // Cleanup
        const createdRole = await Role.fromId(data.id);

        expect(createdRole).toBeDefined();

        await createdRole?.delete();
    });

    test("should return 403 if user tries to create a role with higher priority", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok, raw } = await client.createRole("newRole", {
            permissions: [RolePermission.ManageBlocks],
            priority: 11,
            description: "newRole",
            visible: true,
            icon: "https://example.com/icon.png",
        });

        expect(ok).toBe(false);
        expect(raw.status).toBe(403);
        expect(data).toMatchObject({
            error: "Cannot create role with higher priority than your own",
        });
    });

    test("should return 403 if user tries to create a role with permissions they do not have", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok, raw } = await client.createRole("newRole", {
            permissions: [RolePermission.Impersonate],
            priority: 1,
            description: "newRole",
            visible: true,
            icon: "https://example.com/icon.png",
        });

        expect(ok).toBe(false);
        expect(raw.status).toBe(403);
        expect(data).toMatchObject({
            error: "Cannot create role with permissions you do not have",
            details: "Forbidden permissions: impersonate",
        });
    });
});
