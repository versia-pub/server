import { apiRoute, applyConfig } from "@/api";
import { urlToContentFormat } from "@/content_types";
import { createRoute } from "@hono/zod-openapi";
import { InstanceMetadata as InstanceMetadataSchema } from "@versia/federation/schemas";
import { asc } from "drizzle-orm";
import { User } from "~/classes/database/user";
import { Users } from "~/drizzle/schema";
import pkg from "~/package.json";
import { config } from "~/packages/config-manager";

export const meta = applyConfig({
    auth: {
        required: false,
    },
    ratelimits: {
        duration: 60,
        max: 60,
    },
    route: "/.well-known/versia",
});

const route = createRoute({
    method: "get",
    path: "/.well-known/versia",
    summary: "Get instance metadata",
    responses: {
        200: {
            description: "Instance metadata",
            content: {
                "application/json": {
                    schema: InstanceMetadataSchema,
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        // Get date of first user creation
        const firstUser = await User.fromSql(undefined, asc(Users.createdAt));

        return context.json(
            {
                type: "InstanceMetadata" as const,
                compatibility: {
                    extensions: ["pub.versia:custom_emojis"],
                    versions: ["0.4.0"],
                },
                host: new URL(config.http.base_url).host,
                name: config.instance.name,
                description: config.instance.description,
                public_key: {
                    key: config.instance.keys.public,
                    algorithm: "ed25519" as const,
                },
                software: {
                    name: "Versia Server",
                    version: pkg.version,
                },
                banner: urlToContentFormat(config.instance.banner),
                logo: urlToContentFormat(config.instance.logo),
                created_at: new Date(
                    firstUser?.data.createdAt ?? 0,
                ).toISOString(),
            },
            200,
        );
    }),
);
