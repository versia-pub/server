import { applyConfig, handleZodError } from "@/api";
import { errorResponse, jsonResponse, redirect, response } from "@/response";
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
    query: z.object({
        debug: z
            .string()
            .transform((v) => ["true", "1", "on"].includes(v.toLowerCase()))
            .optional(),
    }),
};

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("param", schemas.param, handleZodError),
        zValidator("query", schemas.query, handleZodError),
        async (context) => {
            const { uuid } = context.req.valid("param");
            const { debug } = context.req.valid("query");

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

            if (debug) {
                return response(JSON.stringify(user.toLysand(), null, 4), 200, {
                    "Content-Type": "application/json",
                });
            }

            // Try to detect a web browser and redirect to the user's profile page
            if (context.req.header("user-agent")?.includes("Mozilla")) {
                return redirect(user.toApi().url);
            }

            return jsonResponse(user.toLysand());
        },
    );
