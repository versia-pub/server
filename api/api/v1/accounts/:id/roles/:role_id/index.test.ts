import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { RolePermission } from "@versia/client/schemas";
import { Role } from "@versia/kit/db";
import { generateClient, getTestUsers } from "~/tests/utils";

const { users, deleteUsers } = await getTestUsers(2);
let role: Role;
let higherPriorityRole: Role;

beforeAll(async () => {
    // Create new role
    role = await Role.insert({
        name: "test",
        permissions: [RolePermission.ManageRoles],
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
        permissions: [RolePermission.ManageRoles],
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
        await using client = await generateClient();

        const { ok, raw } = await client.assignRole(users[1].id, role.id);

        expect(ok).toBe(false);
        expect(raw.status).toBe(401);
    });

    test("should return 404 if role does not exist", async () => {
        await using client = await generateClient(users[0]);

        const { ok, raw } = await client.assignRole(
            users[1].id,
            "00000000-0000-0000-0000-000000000000",
        );

        expect(ok).toBe(false);
        expect(raw.status).toBe(404);
    });

    test("should return 404 if user does not exist", async () => {
        await using client = await generateClient(users[0]);

        const { ok, raw } = await client.assignRole(
            "00000000-0000-0000-0000-000000000000",
            role.id,
        );

        expect(ok).toBe(false);
        expect(raw.status).toBe(404);
    });

    test("should assign role to user", async () => {
        await using client = await generateClient(users[0]);

        const { ok } = await client.assignRole(users[1].id, role.id);

        expect(ok).toBe(true);

        // Check if role was assigned
        const userRoles = await Role.getUserRoles(users[1].id, false);
        expect(userRoles).toContainEqual(
            expect.objectContaining({ id: role.id }),
        );
    });

    test("should return 403 if user tries to assign role with higher priority", async () => {
        await using client = await generateClient(users[0]);

        const { data, ok, raw } = await client.assignRole(
            users[1].id,
            higherPriorityRole.id,
        );

        expect(ok).toBe(false);
        expect(raw.status).toBe(403);
        expect(data).toMatchObject({
            error: "Forbidden",
            details:
                "User with highest role priority 2 cannot assign role with priority 3",
        });
    });

    test("should remove role from user", async () => {
        await using client = await generateClient(users[0]);

        const { ok } = await client.unassignRole(users[1].id, role.id);

        expect(ok).toBe(true);

        // Check if role was removed
        const userRoles = await Role.getUserRoles(users[1].id, false);
        expect(userRoles).not.toContainEqual(
            expect.objectContaining({ id: role.id }),
        );
    });

    test("should return 403 if user tries to remove role with higher priority", async () => {
        await higherPriorityRole.linkUser(users[1].id);

        await using client = await generateClient(users[0]);

        const { data, ok, raw } = await client.unassignRole(
            users[1].id,
            higherPriorityRole.id,
        );

        expect(ok).toBe(false);
        expect(raw.status).toBe(403);
        expect(data).toMatchObject({
            error: "Forbidden",
            details:
                "User with highest role priority 2 cannot remove role with priority 3",
        });

        await higherPriorityRole.unlinkUser(users[1].id);
    });
});
