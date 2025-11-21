import { config } from "@versia-server/config";
import { ApiError } from "@versia-server/kit";
import { apiRoute, handleZodError } from "@versia-server/kit/api";
import { proxy } from "hono/proxy";
import type { ContentfulStatusCode, StatusCode } from "hono/utils/http-status";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";

export default apiRoute((app) =>
    app.get(
        "/media/proxy/:id",
        describeRoute({
            summary: "Proxy media through the server",
            responses: {
                200: {
                    description: "Media",
                    content: {
                        "*": {
                            schema: resolver(z.any()),
                        },
                    },
                },
                400: {
                    description: "Invalid URL to proxy",
                    content: {
                        "application/json": {
                            schema: resolver(ApiError.zodSchema),
                        },
                    },
                },
            },
        }),
        validator(
            "param",
            z.object({
                id: z.base64url().meta({
                    description: "Base64url encoded URL to proxy",
                    type: "string",
                }),
            }),
            handleZodError,
        ),
        async (context) => {
            const { id } = context.req.valid("param");
            const url = Buffer.from(id, "base64url").toString();

            // Check if URL is valid
            if (!URL.canParse(url)) {
                throw new ApiError(
                    400,
                    "Invalid URL",
                    "Should be encoded as base64url",
                );
            }

            const media = await proxy(url, {
                // @ts-expect-error Proxy is a Bun-specific feature
                proxy: config.http.proxy_address,
            });

            // Check if file extension ends in svg or svg
            // Cloudflare R2 serves those as application/xml
            if (
                media.headers.get("Content-Type") === "application/xml" &&
                url.endsWith(".svg")
            ) {
                media.headers.set("Content-Type", "image/svg+xml");
            }

            const realFilename =
                media.headers
                    .get("Content-Disposition")
                    ?.match(/filename="(.+)"/)?.[1] || url.split("/").pop();

            if (!media.body) {
                return context.body(null, media.status as StatusCode);
            }

            return context.body(
                media.body,
                media.status as ContentfulStatusCode,
                {
                    "Content-Type":
                        media.headers.get("Content-Type") ||
                        "application/octet-stream",
                    "Content-Length":
                        media.headers.get("Content-Length") || "0",
                    "Content-Security-Policy": "",
                    // Real filename
                    "Content-Disposition": `inline; filename="${realFilename}"`,
                },
            );
        },
    ),
);
