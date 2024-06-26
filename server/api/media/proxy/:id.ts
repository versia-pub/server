import { applyConfig, handleZodError } from "@/api";
import { errorResponse, response } from "@/response";
import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";
import { z } from "zod";
import { config } from "~/packages/config-manager";

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
            if (!URL.canParse(id)) {
                return errorResponse(
                    "Invalid URL (it should be encoded as base64url",
                    400,
                );
            }

            const media = await fetch(id, {
                headers: {
                    "Accept-Encoding": "br",
                },
                proxy: config.http.proxy.address,
            });

            // Check if file extension ends in svg or svg
            // Cloudflare R2 serves those as application/xml
            if (
                media.headers.get("Content-Type") === "application/xml" &&
                id.endsWith(".svg")
            ) {
                media.headers.set("Content-Type", "image/svg+xml");
            }

            const realFilename =
                media.headers
                    .get("Content-Disposition")
                    ?.match(/filename="(.+)"/)?.[1] || id.split("/").pop();

            return response(media.body, media.status, {
                "Content-Type":
                    media.headers.get("Content-Type") ||
                    "application/octet-stream",
                "Content-Length": media.headers.get("Content-Length") || "0",
                "Content-Security-Policy": "",
                "Content-Encoding": "",
                // Real filename
                "Content-Disposition": `inline; filename="${realFilename}"`,
            });
        },
    );
