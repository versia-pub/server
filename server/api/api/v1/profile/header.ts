import { applyConfig, auth } from "@/api";
import { errorResponse, jsonResponse } from "@/response";
import type { Hono } from "hono";
import { RolePermissions } from "~/drizzle/schema";

export const meta = applyConfig({
    allowedMethods: ["DELETE"],
    ratelimits: {
        max: 10,
        duration: 60,
    },
    route: "/api/v1/profile/header",
    auth: {
        required: true,
    },
    permissions: {
        required: [RolePermissions.MANAGE_OWN_ACCOUNT],
    },
});

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { user: self } = context.req.valid("header");

            if (!self) return errorResponse("Unauthorized", 401);

            await self.update({
                header: "",
            });

            return jsonResponse(self.toAPI(true));
        },
    );
