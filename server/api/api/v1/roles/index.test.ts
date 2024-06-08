import { beforeAll, describe, expect, test } from "bun:test";
import { config } from "config-manager";
import { ADMIN_ROLES } from "~/drizzle/schema";
import { Role } from "~/packages/database-interface/role";
import { getTestUsers, sendTestRequest } from "~/tests/utils";
import { meta } from "./index";

const { users, tokens } = await getTestUsers(1);
let role: Role;

beforeAll(async () => {
    // Create new role
    role = await Role.new({
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

// /api/v1/roles
describe(meta.route, () => {
    test("should return 401 if not authenticated", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "GET",
            }),
        );

        expect(response.status).toBe(401);
    });

    test("should return a list of roles", async () => {
        const response = await sendTestRequest(
            new Request(new URL(meta.route, config.http.base_url), {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${tokens[0].accessToken}`,
                },
            }),
        );

        expect(response.ok).toBe(true);
        const roles = await response.json();
        expect(roles).toHaveLength(1);
        expect(roles[0]).toMatchObject({
            name: "test",
            permissions: ADMIN_ROLES,
            priority: 0,
            description: "test",
            visible: true,
            icon: "test",
        });
    });
});
