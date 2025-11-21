import {
    Account as AccountSchema,
    RolePermission,
    zBoolean,
} from "@versia/client/schemas";
import * as VersiaEntities from "@versia/sdk/entities";
import { config } from "@versia-server/config";
import { ApiError } from "@versia-server/kit";
import {
    apiRoute,
    auth,
    handleZodError,
    jsonOrForm,
} from "@versia-server/kit/api";
import { Emoji, Media, User } from "@versia-server/kit/db";
import { versiaTextToHtml } from "@versia-server/kit/parsers";
import { Users } from "@versia-server/kit/tables";
import { and, eq, isNull } from "drizzle-orm";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import { mergeAndDeduplicate } from "@/lib";
import { sanitizedHtmlStrip } from "@/sanitization";
import { rateLimit } from "../../../../../middlewares/rate-limit.ts";

export default apiRoute((app) =>
    app.patch(
        "/api/v1/accounts/update_credentials",
        describeRoute({
            summary: "Update account credentials",
            description: "Update the user’s display and preferences.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/accounts/#update_credentials",
            },
            tags: ["Accounts"],
            responses: {
                200: {
                    description: "Updated user",
                    content: {
                        "application/json": {
                            schema: resolver(AccountSchema),
                        },
                    },
                },
                401: ApiError.missingAuthentication().schema,
                422: ApiError.validationFailed().schema,
            },
        }),
        rateLimit(5),
        auth({
            auth: true,
            permissions: [RolePermission.ManageOwnAccount],
            scopes: ["write:accounts"],
        }),
        jsonOrForm(),
        validator(
            "json",
            z
                .object({
                    display_name: AccountSchema.shape.display_name
                        .meta({
                            description:
                                "The display name to use for the profile.",
                            example: "Lexi",
                        })
                        .max(
                            config.validation.accounts
                                .max_displayname_characters,
                        )
                        .refine(
                            (s) =>
                                !config.validation.filters.displayname.some(
                                    (filter) => filter.test(s),
                                ),
                            "Display name contains blocked words",
                        ),
                    username: AccountSchema.shape.username
                        .meta({
                            description: "The username to use for the profile.",
                            example: "lexi",
                        })
                        .max(config.validation.accounts.max_username_characters)
                        .refine(
                            (s) =>
                                !config.validation.filters.username.some(
                                    (filter) => filter.test(s),
                                ),
                            "Username contains blocked words",
                        )
                        .refine(
                            (s) =>
                                !config.validation.accounts.disallowed_usernames.some(
                                    (u) => u.test(s),
                                ),
                            "Username is disallowed",
                        ),
                    note: AccountSchema.shape.note
                        .meta({
                            description:
                                "The account bio. Markdown is supported.",
                        })
                        .max(config.validation.accounts.max_bio_characters)
                        .refine(
                            (s) =>
                                !config.validation.filters.bio.some((filter) =>
                                    filter.test(s),
                                ),
                            "Bio contains blocked words",
                        ),
                    avatar: z
                        .url()
                        .meta({
                            description: "Avatar image URL",
                        })
                        .or(
                            z
                                .file()
                                .max(
                                    config.validation.accounts.max_avatar_bytes,
                                )
                                .meta({
                                    description:
                                        "Avatar image encoded using multipart/form-data",
                                }),
                        ),
                    header: z
                        .url()
                        .meta({
                            description: "Header image URL",
                        })
                        .or(
                            z
                                .file()
                                .max(
                                    config.validation.accounts.max_header_bytes,
                                )
                                .meta({
                                    description:
                                        "Header image encoded using multipart/form-data",
                                }),
                        ),
                    locked: AccountSchema.shape.locked.meta({
                        description:
                            "Whether manual approval of follow requests is required.",
                    }),
                    bot: AccountSchema.shape.bot.meta({
                        description: "Whether the account has a bot flag.",
                    }),
                    discoverable: AccountSchema.shape.discoverable
                        .unwrap()
                        .meta({
                            description:
                                "Whether the account should be shown in the profile directory.",
                        }),
                    hide_collections: zBoolean.meta({
                        description:
                            "Whether to hide followers and followed accounts.",
                    }),
                    indexable: zBoolean.meta({
                        description:
                            "Whether public posts should be searchable to anyone.",
                    }),
                    // TODO: Implement :(
                    attribution_domains: z.array(z.string()).meta({
                        description:
                            "Domains of websites allowed to credit the account.",
                        example: ["cnn.com", "myblog.com"],
                    }),
                    source: z
                        .object({
                            privacy:
                                AccountSchema.shape.source.unwrap().shape
                                    .privacy,
                            sensitive:
                                AccountSchema.shape.source.unwrap().shape
                                    .sensitive,
                            language:
                                AccountSchema.shape.source.unwrap().shape
                                    .language,
                        })
                        .partial(),
                    fields_attributes: z
                        .array(
                            z.object({
                                name: AccountSchema.shape.fields.element.shape.name.max(
                                    config.validation.accounts
                                        .max_field_name_characters,
                                ),
                                value: AccountSchema.shape.fields.element.shape.value.max(
                                    config.validation.accounts
                                        .max_field_value_characters,
                                ),
                            }),
                        )
                        .max(config.validation.accounts.max_field_count),
                })
                .partial(),
            handleZodError,
        ),
        async (context) => {
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
                hide_collections,
                indexable,
                source,
                fields_attributes,
            } = context.req.valid("json");

            const self = user.data;
            if (!self.source) {
                self.source = {
                    fields: [],
                    privacy: "public",
                    language: "en",
                    sensitive: false,
                    note: "",
                };
            }

            const sanitizedDisplayName = await sanitizedHtmlStrip(
                display_name ?? "",
            );

            if (display_name) {
                self.displayName = sanitizedDisplayName;
            }

            if (note) {
                self.source.note = note;
                self.note = await versiaTextToHtml(
                    new VersiaEntities.TextContentFormat({
                        "text/markdown": {
                            content: note,
                            remote: false,
                        },
                    }),
                );
            }

            if (source) {
                self.source = {
                    ...self.source,
                    privacy: source.privacy ?? self.source.privacy,
                    sensitive: source.sensitive ?? self.source.sensitive,
                    language: source.language ?? self.source.language,
                };
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
                    if (user.avatar) {
                        await user.avatar.updateFromFile(avatar);
                    } else {
                        user.avatar = await Media.fromFile(avatar);
                    }
                } else if (user.avatar) {
                    await user.avatar.updateFromUrl(new URL(avatar));
                } else {
                    user.avatar = await Media.fromUrl(new URL(avatar));
                }
            }

            if (header) {
                if (header instanceof File) {
                    if (user.header) {
                        await user.header.updateFromFile(header);
                    } else {
                        user.header = await Media.fromFile(header);
                    }
                } else if (user.header) {
                    await user.header.updateFromUrl(new URL(header));
                } else {
                    user.header = await Media.fromUrl(new URL(header));
                }
            }

            if (locked) {
                self.isLocked = locked;
            }

            if (bot !== undefined) {
                self.isBot = bot;
            }

            if (discoverable !== undefined) {
                self.isDiscoverable = discoverable;
            }

            if (hide_collections !== undefined) {
                self.isHidingCollections = hide_collections;
            }

            if (indexable !== undefined) {
                self.isIndexable = indexable;
            }

            const fieldEmojis: Emoji[] = [];

            if (fields_attributes) {
                self.fields = [];
                self.source.fields = [];
                for (const field of fields_attributes) {
                    // Can be Markdown or plaintext, also has emojis
                    const parsedName = await versiaTextToHtml(
                        new VersiaEntities.TextContentFormat({
                            "text/markdown": {
                                content: field.name,
                                remote: false,
                            },
                        }),
                        undefined,
                        true,
                    );

                    const parsedValue = await versiaTextToHtml(
                        new VersiaEntities.TextContentFormat({
                            "text/markdown": {
                                content: field.value,
                                remote: false,
                            },
                        }),
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
                avatarId: user.avatar?.id,
                header: self.header,
                headerId: user.header?.id,
                fields: self.fields,
                isLocked: self.isLocked,
                isBot: self.isBot,
                isDiscoverable: self.isDiscoverable,
                isHidingCollections: self.isHidingCollections,
                isIndexable: self.isIndexable,
                source: self.source || undefined,
            });

            const output = await User.fromId(self.id);

            if (!output) {
                throw new ApiError(500, "Couldn't edit user");
            }

            return context.json(output.toApi(), 200);
        },
    ),
);
