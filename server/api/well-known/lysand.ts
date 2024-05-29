import { applyConfig } from "@/api";
import { urlToContentFormat } from "@/content_types";
import { jsonResponse } from "@/response";
import type { EntityValidator } from "@lysand-org/federation";
import type { Hono } from "hono";
import pkg from "~/package.json";
import { config } from "~/packages/config-manager";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    auth: {
        required: false,
    },
    ratelimits: {
        duration: 60,
        max: 60,
    },
    route: "/.well-known/lysand",
});

export default (app: Hono) =>
    app.on(meta.allowedMethods, meta.route, async () => {
        return jsonResponse({
            type: "ServerMetadata",
            name: config.instance.name,
            version: pkg.version,
            description: config.instance.description,
            logo: urlToContentFormat(config.instance.logo) ?? undefined,
            banner: urlToContentFormat(config.instance.banner) ?? undefined,
            supported_extensions: ["org.lysand:custom_emojis"],
            website: "https://lysand.org",
        } satisfies typeof EntityValidator.$ServerMetadata);
    });
