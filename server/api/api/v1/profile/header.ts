import { applyConfig, auth } from "@/api";
import { errorResponse, jsonResponse } from "@/response";
import type { Hono } from "hono";

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
});

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        auth(meta.auth),
        async (context) => {
            const { user: self } = context.req.valid("header");

            if (!self) return errorResponse("Unauthorized", 401);

            await self.update({
                header: "",
            });

            return jsonResponse(self.toAPI(true));
        },
    );
