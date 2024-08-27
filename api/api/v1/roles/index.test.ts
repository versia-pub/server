import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ADMIN_ROLES } from "~/drizzle/schema";
import { config } from "~/packages/config-manager/index";
import { Role } from "~/packages/database-interface/role";
import { fakeRequest, getTestUsers } from "~/tests/utils";
import { meta } from "./index";

const { users, deleteUsers, tokens } = await getTestUsers(1);
let role: Role;

beforeAll(async () => {
    // Create new role
    role = await Role.insert({
        name: "test",
        permissions: ADMIN_ROLES,
        priority: 0,
        description: "test",
        visible: true,
        icon: "test",
    });

    expect(role).toBeDefined();

    // Link role to user
    await role.linkUser(users[0].id);
});

afterAll(async () => {
    await deleteUsers();
});

// /api/v1/roles
describe(meta.route, () => {
    test("should return 401 if not authenticated", async () => {
        const response = await fakeRequest(meta.route, {
            method: "GET",
        });

        expect(response.status).toBe(401);
    });

    test("should return a list of roles", async () => {
        const response = await fakeRequest(meta.route, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${tokens[0].accessToken}`,
            },
        });

        expect(response.ok).toBe(true);
        const roles = await response.json();
        expect(roles).toHaveLength(2);
        expect(roles[0]).toMatchObject({
            name: "test",
            permissions: ADMIN_ROLES,
            priority: 0,
            description: "test",
            visible: true,
            icon: expect.any(String),
        });

        expect(roles[1]).toMatchObject({
            name: "Default",
            permissions: config.permissions.default,
            priority: 0,
            description: "Default role for all users",
            visible: false,
            icon: null,
        });
    });
});
