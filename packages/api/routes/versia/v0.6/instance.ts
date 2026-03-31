import {
    type ImageContentFormatSchema,
    InstanceMetadataSchema,
} from "@versia/sdk/schemas";
import { config } from "@versia-server/config";
import { apiRoute } from "@versia-server/kit/api";
import { User } from "@versia-server/kit/db";
import { Users } from "@versia-server/kit/tables";
import { asc } from "drizzle-orm";
import { describeRoute, resolver } from "hono-openapi";
import type z from "zod";
import { urlToContentFormat } from "@/content_types";
import pkg from "../../../../../package.json" with { type: "json" };

export default apiRoute((app) =>
    app.get(
        "/.versia/v0.6/instance",
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
                            "pub.versia:likes",
                            "pub.versia:shares",
                            "pub.versia:reactions",
                        ],
                        versions: ["0.6.0"],
                    },
                    domain: config.http.base_url.hostname,
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
                        ? (urlToContentFormat(
                              config.instance.branding.banner,
                          ) as z.infer<typeof ImageContentFormatSchema>)
                        : undefined,
                    logo: config.instance.branding.logo
                        ? (urlToContentFormat(
                              config.instance.branding.logo,
                          ) as z.infer<typeof ImageContentFormatSchema>)
                        : undefined,
                    created_at:
                        firstUser?.data.createdAt.toISOString() ||
                        "1970-01-01T00:00:00Z",
                } satisfies z.infer<typeof InstanceMetadataSchema>,
                200,
            );
        },
    ),
);
