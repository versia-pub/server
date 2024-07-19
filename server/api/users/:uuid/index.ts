import { applyConfig, handleZodError } from "@/api";
import { errorResponse, jsonResponse } from "@/response";
import type { Hono } from "@hono/hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { User } from "~/packages/database-interface/user";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    auth: {
        required: false,
    },
    ratelimits: {
        duration: 60,
        max: 500,
    },
    route: "/users/:uuid",
});

export const schemas = {
    param: z.object({
        uuid: z.string().uuid(),
    }),
};

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("param", schemas.param, handleZodError),
        async (context) => {
            const { uuid } = context.req.valid("param");

            const user = await User.fromId(uuid);

            if (!user) {
                return errorResponse("User not found", 404);
            }

            if (user.isRemote()) {
                return errorResponse(
                    "Cannot view users from remote instances",
                    403,
                );
            }

            return jsonResponse(user.toLysand());
        },
    );
