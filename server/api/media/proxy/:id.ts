import { applyConfig, handleZodError } from "@/api";
import { errorResponse, response } from "@/response";
import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";
import { z } from "zod";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    route: "/media/proxy/:id",
    ratelimits: {
        max: 100,
        duration: 60,
    },
    auth: {
        required: false,
    },
});

export const schemas = {
    param: z.object({
        id: z
            .string()
            .transform((val) => Buffer.from(val, "base64url").toString()),
    }),
};

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("param", schemas.param, handleZodError),
        async (context) => {
            const { id } = context.req.valid("param");

            // Check if URL is valid
            if (!URL.canParse(id))
                return errorResponse(
                    "Invalid URL (it should be encoded as base64url",
                    400,
                );

            return fetch(id, {
                headers: {
                    "Accept-Encoding": "identity",
                },
            }).then((res) => {
                return response(res.body, res.status, res.headers.toJSON());
            });
        },
    );
