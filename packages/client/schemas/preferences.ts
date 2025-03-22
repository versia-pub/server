import { z } from "@hono/zod-openapi";
import { Source } from "./account.ts";

export const Preferences = z
    .object({
        "posting:default:visibility": Source.shape.privacy.openapi({
            description: "Default visibility for new posts.",
            example: "public",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Preferences/#posting-default-visibility",
            },
        }),
        "posting:default:sensitive": Source.shape.sensitive.openapi({
            description: "Default sensitivity flag for new posts.",
            example: false,
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Preferences/#posting-default-sensitive",
            },
        }),
        "posting:default:language": Source.shape.language.nullable().openapi({
            description: "Default language for new posts.",
            example: null,
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Preferences/#posting-default-language",
            },
        }),
        "reading:expand:media": z
            .enum(["default", "show_all", "hide_all"])
            .openapi({
                description:
                    "Whether media attachments should be automatically displayed or blurred/hidden.",
                example: "default",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Preferences/#reading-expand-media",
                },
            }),
        "reading:expand:spoilers": z.boolean().openapi({
            description: "Whether CWs should be expanded by default.",
            example: false,
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Preferences/#reading-expand-spoilers",
            },
        }),
    })
    .openapi({
        description: "Represents a user's preferences.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Preferences",
        },
    });
