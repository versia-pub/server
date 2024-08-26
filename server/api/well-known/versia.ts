import { apiRoute, applyConfig } from "@/api";
import { urlToContentFormat } from "@/content_types";
import type { InstanceMetadata } from "@versia/federation/types";
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
    route: "/.well-known/versia",
});

export default apiRoute((app) =>
    app.on(meta.allowedMethods, meta.route, (context) => {
        return context.json({
            type: "InstanceMetadata",
            compatibility: {
                extensions: ["pub.versia:custom_emojis"],
                versions: ["0.3.1", "0.4.0"],
            },
            host: new URL(config.http.base_url).host,
            name: config.instance.name,
            description: {
                "text/plain": {
                    content: config.instance.description,
                    remote: false,
                },
            },
            public_key: {
                key: config.instance.keys.public,
                algorithm: "ed25519",
            },
            software: {
                name: "Versia Server",
                version: pkg.version,
            },
            banner: urlToContentFormat(config.instance.banner),
            logo: urlToContentFormat(config.instance.logo),
            created_at: "2021-10-01T00:00:00Z",
        } satisfies InstanceMetadata);
    }),
);
