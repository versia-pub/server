import { applyConfig, auth } from "@/api";
import { renderMarkdownInPath } from "@/markdown";
import { jsonResponse } from "@/response";
import type { Hono } from "@hono/hono";
import { config } from "~/packages/config-manager";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    route: "/api/v1/instance/tos",
    ratelimits: {
        max: 300,
        duration: 60,
    },
    auth: {
        required: false,
    },
});

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        auth(meta.auth, meta.permissions),
        async () => {
            const { content, lastModified } = await renderMarkdownInPath(
                config.instance.tos_path ?? "",
                "This instance has not provided any terms of service.",
            );

            return jsonResponse({
                updated_at: lastModified.toISOString(),
                content,
            });
        },
    );
