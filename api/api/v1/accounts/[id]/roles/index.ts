import { Role as RoleSchema } from "@versia/client/schemas";
import { Role } from "@versia/kit/db";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { z } from "zod";
import { apiRoute, auth, withUserParam } from "@/api";

export default apiRoute((app) => {
    app.get(
        "/api/v1/accounts/:id/roles",
        describeRoute({
            summary: "List account roles",
            tags: ["Accounts"],
            responses: {
                200: {
                    description: "List of roles",
                    content: {
                        "application/json": {
                            schema: resolver(z.array(RoleSchema)),
                        },
                    },
                },
            },
        }),
        withUserParam,
        auth({
            auth: false,
        }),
        async (context) => {
            const targetUser = context.get("user");

            const roles = await Role.getUserRoles(
                targetUser.id,
                targetUser.data.isAdmin,
            );

            return context.json(
                roles.map((role) => role.toApi()),
                200,
            );
        },
    );
});
