import { applyConfig, auth } from "@/api";
import { errorResponse, jsonResponse } from "@/response";
import type { Hono } from "hono";
import { Role } from "~/packages/database-interface/role";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    auth: {
        required: true,
    },
    ratelimits: {
        duration: 60,
        max: 20,
    },
    route: "/api/v1/roles",
});

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        auth(meta.auth),
        async (context) => {
            const { user } = context.req.valid("header");

            if (!user) {
                return errorResponse("Unauthorized", 401);
            }

            const userRoles = await Role.getUserRoles(user.id);

            return jsonResponse(userRoles.map((r) => r.toAPI()));
        },
    );
