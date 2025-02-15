import { apiRoute } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { proxy } from "hono/proxy";
import type { ContentfulStatusCode, StatusCode } from "hono/utils/http-status";
import { ApiError } from "~/classes/errors/api-error";
import { config } from "~/config.ts";
import { ErrorSchema } from "~/types/api";

const schemas = {
    param: z.object({
        id: z
            .string()
            .transform((val) => Buffer.from(val, "base64url").toString()),
    }),
};

const route = createRoute({
    method: "get",
    path: "/media/proxy/{id}",
    summary: "Proxy media through the server",
    request: {
        params: schemas.param,
    },
    responses: {
        200: {
            description: "Media",
            content: {
                "*": {
                    schema: z.any(),
                },
            },
        },
        400: {
            description: "Invalid URL to proxy",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { id } = context.req.valid("param");

        // Check if URL is valid
        if (!URL.canParse(id)) {
            throw new ApiError(
                400,
                "Invalid URL",
                "Should be encoded as base64url",
            );
        }

        const media = await proxy(id, {
            // @ts-expect-error Proxy is a Bun-specific feature
            proxy: config.http.proxy_address,
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

        if (!media.body) {
            return context.body(null, media.status as StatusCode);
        }

        return context.body(media.body, media.status as ContentfulStatusCode, {
            "Content-Type":
                media.headers.get("Content-Type") || "application/octet-stream",
            "Content-Length": media.headers.get("Content-Length") || "0",
            "Content-Security-Policy": "",
            // Real filename
            "Content-Disposition": `inline; filename="${realFilename}"`,
        });
    }),
);
