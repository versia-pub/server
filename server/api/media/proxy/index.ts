import { applyConfig, handleZodError } from "@api";
import { zValidator } from "@hono/zod-validator";
import { errorResponse, response } from "@response";
import type { Hono } from "hono";
import { z } from "zod";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    route: "/api/media/proxy",
    ratelimits: {
        max: 100,
        duration: 60,
    },
    auth: {
        required: false,
    },
});

export const schemas = {
    query: z.object({
        url: z
            .string()
            .transform((val) => Buffer.from(val, "base64url").toString()),
    }),
};

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("query", schemas.query, handleZodError),
        async (context) => {
            const { url } = context.req.valid("query");

            // Check if URL is valid
            if (!URL.canParse(url))
                return errorResponse(
                    "Invalid URL (it should be encoded as base64url",
                    400,
                );

            return fetch(url).then((res) => {
                return response(res.body, res.status, res.headers.toJSON());
            });
        },
    );
