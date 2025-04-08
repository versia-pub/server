import { apiRoute } from "@/api";
import { urlToContentFormat } from "@/content_types";
import { User } from "@versia/kit/db";
import { Users } from "@versia/kit/tables";
import { InstanceMetadataSchema } from "@versia/sdk/schemas";
import { asc } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { config } from "~/config.ts";
import pkg from "~/package.json";

export default apiRoute((app) =>
    app.get(
        "/.well-known/versia",
        describeRoute({
            summary: "Get instance metadata",
            tags: ["Federation"],
            responses: {
                200: {
                    description: "Instance metadata",
                    content: {
                        "application/json": {
                            schema: resolver(InstanceMetadataSchema),
                        },
                    },
                },
            },
        }),
        async (context) => {
            // Get date of first user creation
            const firstUser = await User.fromSql(
                undefined,
                asc(Users.createdAt),
            );

            const publicKey = Buffer.from(
                await crypto.subtle.exportKey(
                    "spki",
                    config.instance.keys.public,
                ),
            ).toString("base64");

            return context.json(
                {
                    type: "InstanceMetadata" as const,
                    compatibility: {
                        extensions: [
                            "pub.versia:custom_emojis",
                            "pub.versia:instance_messaging",
                        ],
                        versions: ["0.5.0"],
                    },
                    host: config.http.base_url.host,
                    name: config.instance.name,
                    description: config.instance.description,
                    public_key: {
                        key: publicKey,
                        algorithm: "ed25519" as const,
                    },
                    software: {
                        name: "Versia Server",
                        version: pkg.version,
                    },
                    banner: config.instance.branding.banner
                        ? urlToContentFormat(config.instance.branding.banner)
                        : undefined,
                    logo: config.instance.branding.logo
                        ? urlToContentFormat(config.instance.branding.logo)
                        : undefined,
                    shared_inbox: new URL(
                        "/inbox",
                        config.http.base_url,
                    ).toString(),
                    created_at: new Date(
                        firstUser?.data.createdAt ?? 0,
                    ).toISOString(),
                    extensions: {
                        "pub.versia:instance_messaging": {
                            endpoint: new URL(
                                "/messaging",
                                config.http.base_url,
                            ).toString(),
                        },
                    },
                },
                200,
            );
        },
    ),
);
