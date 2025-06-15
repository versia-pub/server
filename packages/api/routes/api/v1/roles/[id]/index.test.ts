import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { RolePermission } from "@versia/client/schemas";
import { Role } from "@versia/kit/db";
import { randomUUIDv7 } from "bun";
import { generateClient, getTestUsers } from "~/tests/utils";

const { users, deleteUsers } = await getTestUsers(2);
let role: Role;
let higherPriorityRole: Role;

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

    // Create a role with higher priority than the user's role
    higherPriorityRole = await Role.insert({
        id: randomUUIDv7(),
        name: "higherPriorityRole",
        permissions: [RolePermission.ManageRoles],
        priority: 3, // Higher priority than the user's role
        description: "Higher priority role",
        visible: true,
    });

    expect(higherPriorityRole).toBeDefined();
});

afterAll(async () => {
    await role.delete();
    await higherPriorityRole.delete();
    await deleteUsers();
});

// /api/v1/roles/:id
describe("/api/v1/roles/:id", () => {
    test("should return 401 if not authenticated", async () => {
        await using client = await generateClient();

        const { ok, raw } = await client.getRole(role.id);

        expect(ok).toBe(false);
        expect(raw.status).toBe(401);
    });

    test("should return 404 if role does not exist", async () => {
        await using client = await generateClient(users[0]);

        const { ok, raw } = await client.getRole(
            "00000000-0000-0000-0000-000000000000",
        );

        expect(ok).toBe(false);
        expect(raw.status).toBe(404);
    });

    test("should return role data", async () => {
        await using client = await generateClient(users[0]);

        const { ok, data } = await client.getRole(role.id);

        expect(ok).toBe(true);
        expect(data).toMatchObject({
            id: role.id,
            name: role.data.name,
            permissions: role.data.permissions,
            priority: role.data.priority,
            description: role.data.description,
            visible: role.data.visible,
            icon: expect.any(String),
        });
    });

    test("should return 401 if not authenticated", async () => {
        await using client = await generateClient();

        const { ok, raw } = await client.updateRole(role.id, {
            name: "updatedName",
        });

        expect(ok).toBe(false);
        expect(raw.status).toBe(401);
    });

    test("should return 404 if role does not exist", async () => {
        await using client = await generateClient(users[0]);

        const { ok, raw } = await client.updateRole(
            "00000000-0000-0000-0000-000000000000",
            {
                name: "updatedName",
            },
        );

        expect(ok).toBe(false);
        expect(raw.status).toBe(404);
    });

    test("should update role data", async () => {
        await using client = await generateClient(users[0]);

        const { ok } = await client.updateRole(role.id, {
            name: "updatedName",
        });

        expect(ok).toBe(true);

        const updatedRole = await Role.fromId(role.id);
        expect(updatedRole?.data.name).toBe("updatedName");
    });

    test("should return 403 if user tries to update role with higher priority", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok, raw } = await client.updateRole(
            higherPriorityRole.id,
            {
                name: "updatedName",
            },
        );

        expect(ok).toBe(false);
        expect(raw.status).toBe(403);
        expect(data).toMatchObject({
            error: "Forbidden",
            details:
                "User with highest role priority 2 cannot edit role with priority 3",
        });
    });

    test("should return 403 if user tries to update role with permissions they do not have", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok, raw } = await client.updateRole(role.id, {
            permissions: [RolePermission.Impersonate],
        });

        expect(ok).toBe(false);
        expect(raw.status).toBe(403);
        expect(data).toMatchObject({
            error: "Forbidden",
            details: "User cannot add or remove permissions they do not have",
        });
    });

    test("should return 401 if not authenticated", async () => {
        await using client = await generateClient();

        const { ok, raw } = await client.deleteRole(role.id);

        expect(ok).toBe(false);
        expect(raw.status).toBe(401);
    });

    test("should return 404 if role does not exist", async () => {
        await using client = await generateClient(users[0]);

        const { ok, raw } = await client.deleteRole(
            "00000000-0000-0000-0000-000000000000",
        );

        expect(ok).toBe(false);
        expect(raw.status).toBe(404);
    });

    test("should delete role", async () => {
        const newRole = await Role.insert({
            id: randomUUIDv7(),
            name: "test2",
            permissions: [RolePermission.ManageRoles],
            priority: 2,
            description: "test",
            visible: true,
            icon: "https://test.com",
        });

        await using client = await generateClient(users[0]);

        const { ok } = await client.deleteRole(newRole.id);

        expect(ok).toBe(true);

        const deletedRole = await Role.fromId(newRole.id);
        expect(deletedRole).toBeNull();
    });

    test("should return 403 if user tries to delete role with higher priority", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok, raw } = await client.deleteRole(
            higherPriorityRole.id,
        );

        expect(ok).toBe(false);
        expect(raw.status).toBe(403);
        expect(data).toMatchObject({
            error: "Forbidden",
            details:
                "User with highest role priority 2 cannot delete role with priority 3",
        });
    });
});
