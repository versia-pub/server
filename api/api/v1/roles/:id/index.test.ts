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

// /api/v1/roles/:id
describe("/api/v1/roles/:id", () => {
    test("should return 401 if not authenticated", async () => {
        const response = await fakeRequest(`/api/v1/roles/${role.id}`, {
            method: "GET",
        });

        expect(response.status).toBe(401);
    });

    test("should return 404 if role does not exist", async () => {
        const response = await fakeRequest(
            "/api/v1/roles/00000000-0000-0000-0000-000000000000",
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
            },
        );

        expect(response.status).toBe(404);
    });

    test("should return role data", async () => {
        const response = await fakeRequest(`/api/v1/roles/${role.id}`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
            },
        });

        expect(response.status).toBe(200);
        const responseData = await response.json();
        expect(responseData).toMatchObject({
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
        const response = await fakeRequest(`/api/v1/roles/${role.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "updatedName" }),
        });

        expect(response.status).toBe(401);
    });

    test("should return 404 if role does not exist", async () => {
        const response = await fakeRequest(
            "/api/v1/roles/00000000-0000-0000-0000-000000000000",
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ name: "updatedName" }),
            },
        );

        expect(response.status).toBe(404);
    });

    test("should update role data", async () => {
        const response = await fakeRequest(`/api/v1/roles/${role.id}`, {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ name: "updatedName" }),
        });

        expect(response.status).toBe(204);

        const updatedRole = await Role.fromId(role.id);
        expect(updatedRole?.data.name).toBe("updatedName");
    });

    test("should return 403 if user tries to update role with higher priority", async () => {
        const response = await fakeRequest(
            `/api/v1/roles/${higherPriorityRole.id}`,
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ name: "updatedName" }),
            },
        );

        expect(response.status).toBe(403);
        const output = await response.json();
        expect(output).toMatchObject({
            error: "Forbidden",
            details:
                "User with highest role priority 2 cannot edit role with priority 3",
        });
    });

    test("should return 403 if user tries to update role with permissions they do not have", async () => {
        const response = await fakeRequest(`/api/v1/roles/${role.id}`, {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                permissions: [RolePermissions.Impersonate],
            }),
        });

        expect(response.status).toBe(403);
        const output = await response.json();
        expect(output).toMatchObject({
            error: "Forbidden",
            details: "User cannot add or remove permissions they do not have",
        });
    });

    test("should return 401 if not authenticated", async () => {
        const response = await fakeRequest(`/api/v1/roles/${role.id}`, {
            method: "DELETE",
        });

        expect(response.status).toBe(401);
    });

    test("should return 404 if role does not exist", async () => {
        const response = await fakeRequest(
            "/api/v1/roles/00000000-0000-0000-0000-000000000000",
            {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${tokens[0].data.accessToken}`,
                },
            },
        );

        expect(response.status).toBe(404);
    });

    test("should delete role", async () => {
        const newRole = await Role.insert({
            name: "test2",
            permissions: [RolePermissions.ManageRoles],
            priority: 2,
            description: "test",
            visible: true,
            icon: "test",
        });

        const response = await fakeRequest(`/api/v1/roles/${newRole.id}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${tokens[0].data.accessToken}`,
            },
        });

        expect(response.status).toBe(204);

        const deletedRole = await Role.fromId(newRole.id);
        expect(deletedRole).toBeNull();
    });

    test("should return 403 if user tries to delete role with higher priority", async () => {
        const response = await fakeRequest(
            `/api/v1/roles/${higherPriorityRole.id}`,
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
            error: "Forbidden",
            details:
                "User with highest role priority 2 cannot delete role with priority 3",
        });
    });
});
