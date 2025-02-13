import { apiRoute, auth, jsonOrForm, reusedResponses } from "@/api";
import { mergeAndDeduplicate } from "@/lib";
import { sanitizedHtmlStrip } from "@/sanitization";
import { createRoute, z } from "@hono/zod-openapi";
import { Emoji, User } from "@versia/kit/db";
import { RolePermissions, Users } from "@versia/kit/tables";
import { and, eq, isNull } from "drizzle-orm";
import { ApiError } from "~/classes/errors/api-error";
import { contentToHtml } from "~/classes/functions/status";
import { Account as AccountSchema } from "~/classes/schemas/account";
import { zBoolean } from "~/packages/config-manager/config.type";
import { config } from "~/packages/config-manager/index.ts";

const route = createRoute({
    method: "patch",
    path: "/api/v1/accounts/update_credentials",
    summary: "Update account credentials",
    description: "Update the user’s display and preferences.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/accounts/#update_credentials",
    },
    tags: ["Accounts"],
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermissions.ManageOwnAccount],
            scopes: ["write:accounts"],
        }),
        jsonOrForm(),
    ] as const,
    request: {
        body: {
            content: {
                "application/json": {
                    schema: z
                        .object({
                            display_name:
                                AccountSchema.shape.display_name.openapi({
                                    description:
                                        "The display name to use for the profile.",
                                    example: "Lexi",
                                }),
                            username: AccountSchema.shape.username.openapi({
                                description:
                                    "The username to use for the profile.",
                                example: "lexi",
                            }),
                            note: AccountSchema.shape.note.openapi({
                                description:
                                    "The account bio. Markdown is supported.",
                            }),
                            avatar: z
                                .string()
                                .url()
                                .transform((a) => new URL(a))
                                .openapi({
                                    description: "Avatar image URL",
                                })
                                .or(
                                    z
                                        .instanceof(File)
                                        .refine(
                                            (v) =>
                                                v.size <=
                                                config.validation
                                                    .max_avatar_size,
                                            `Avatar must be less than ${config.validation.max_avatar_size} bytes`,
                                        )
                                        .openapi({
                                            description:
                                                "Avatar image encoded using multipart/form-data",
                                        }),
                                ),
                            header: z
                                .string()
                                .url()
                                .transform((v) => new URL(v))
                                .openapi({
                                    description: "Header image URL",
                                })
                                .or(
                                    z
                                        .instanceof(File)
                                        .refine(
                                            (v) =>
                                                v.size <=
                                                config.validation
                                                    .max_header_size,
                                            `Header must be less than ${config.validation.max_header_size} bytes`,
                                        )
                                        .openapi({
                                            description:
                                                "Header image encoded using multipart/form-data",
                                        }),
                                ),
                            locked: AccountSchema.shape.locked.openapi({
                                description:
                                    "Whether manual approval of follow requests is required.",
                            }),
                            bot: AccountSchema.shape.bot.openapi({
                                description:
                                    "Whether the account has a bot flag.",
                            }),
                            discoverable:
                                AccountSchema.shape.discoverable.openapi({
                                    description:
                                        "Whether the account should be shown in the profile directory.",
                                }),
                            // TODO: Implement :(
                            hide_collections: zBoolean.openapi({
                                description:
                                    "Whether to hide followers and followed accounts.",
                            }),
                            // TODO: Implement :(
                            indexable: zBoolean.openapi({
                                description:
                                    "Whether public posts should be searchable to anyone.",
                            }),
                            // TODO: Implement :(
                            attribution_domains: z.array(z.string()).openapi({
                                description:
                                    "Domains of websites allowed to credit the account.",
                                example: ["cnn.com", "myblog.com"],
                            }),
                            source: z
                                .object({
                                    privacy:
                                        AccountSchema.shape.source.unwrap()
                                            .shape.privacy,
                                    sensitive:
                                        AccountSchema.shape.source.unwrap()
                                            .shape.sensitive,
                                    language:
                                        AccountSchema.shape.source.unwrap()
                                            .shape.language,
                                })
                                .partial(),
                            fields_attributes: z
                                .array(
                                    z.object({
                                        name: AccountSchema.shape.fields.element
                                            .shape.name,
                                        value: AccountSchema.shape.fields
                                            .element.shape.value,
                                    }),
                                )
                                .max(config.validation.max_field_count),
                        })
                        .partial(),
                },
            },
        },
    },
    responses: {
        200: {
            description: "Updated user",
            content: {
                "application/json": {
                    schema: AccountSchema,
                },
            },
        },
        ...reusedResponses,
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { user } = context.get("auth");
        const {
            display_name,
            username,
            note,
            avatar,
            header,
            locked,
            bot,
            discoverable,
            source,
            fields_attributes,
        } = context.req.valid("json");

        const self = user.data;

        const sanitizedDisplayName = await sanitizedHtmlStrip(
            display_name ?? "",
        );

        if (display_name) {
            self.displayName = sanitizedDisplayName;
        }

        if (note && self.source) {
            self.source.note = note;
            self.note = await contentToHtml({
                "text/markdown": {
                    content: note,
                    remote: false,
                },
            });
        }

        if (source?.privacy) {
            self.source.privacy = source.privacy;
        }

        if (source?.sensitive) {
            self.source.sensitive = source.sensitive;
        }

        if (source?.language) {
            self.source.language = source.language;
        }

        if (username) {
            // Check if username is already taken
            const existingUser = await User.fromSql(
                and(isNull(Users.instanceId), eq(Users.username, username)),
            );

            if (existingUser) {
                throw new ApiError(422, "Username is already taken");
            }

            self.username = username;
        }

        if (avatar) {
            if (avatar instanceof File) {
                await user.avatar?.updateFromFile(avatar);
            } else {
                await user.avatar?.updateFromUrl(avatar);
            }
        }

        if (header) {
            if (header instanceof File) {
                await user.header?.updateFromFile(header);
            } else {
                await user.header?.updateFromUrl(header);
            }
        }

        if (locked) {
            self.isLocked = locked;
        }

        if (bot) {
            self.isBot = bot;
        }

        if (discoverable) {
            self.isDiscoverable = discoverable;
        }

        const fieldEmojis: Emoji[] = [];

        if (fields_attributes) {
            self.fields = [];
            self.source.fields = [];
            for (const field of fields_attributes) {
                // Can be Markdown or plaintext, also has emojis
                const parsedName = await contentToHtml(
                    {
                        "text/markdown": {
                            content: field.name,
                            remote: false,
                        },
                    },
                    undefined,
                    true,
                );

                const parsedValue = await contentToHtml(
                    {
                        "text/markdown": {
                            content: field.value,
                            remote: false,
                        },
                    },
                    undefined,
                    true,
                );

                // Parse emojis
                const nameEmojis = await Emoji.parseFromText(parsedName);
                const valueEmojis = await Emoji.parseFromText(parsedValue);

                fieldEmojis.push(...nameEmojis, ...valueEmojis);

                // Replace fields
                self.fields.push({
                    key: {
                        "text/html": {
                            content: parsedName,
                            remote: false,
                        },
                    },
                    value: {
                        "text/html": {
                            content: parsedValue,
                            remote: false,
                        },
                    },
                });

                self.source.fields.push({
                    name: field.name,
                    value: field.value,
                    verified_at: null,
                });
            }
        }

        // Parse emojis
        const displaynameEmojis =
            await Emoji.parseFromText(sanitizedDisplayName);
        const noteEmojis = await Emoji.parseFromText(self.note);

        const emojis = mergeAndDeduplicate(
            displaynameEmojis,
            noteEmojis,
            fieldEmojis,
        );

        // Connect emojis, if any
        // Do it before updating user, so that federation takes that into account
        await user.updateEmojis(emojis);
        await user.update({
            displayName: self.displayName,
            username: self.username,
            note: self.note,
            avatar: self.avatar,
            header: self.header,
            fields: self.fields,
            isLocked: self.isLocked,
            isBot: self.isBot,
            isDiscoverable: self.isDiscoverable,
            source: self.source || undefined,
        });

        const output = await User.fromId(self.id);

        if (!output) {
            throw new ApiError(500, "Couldn't edit user");
        }

        return context.json(output.toApi(), 200);
    }),
);
