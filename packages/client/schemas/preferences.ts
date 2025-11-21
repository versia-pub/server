import { z } from "zod";
import { Source } from "./account.ts";

export const Preferences = z
    .object({
        "posting:default:visibility": Source.shape.privacy.meta({
            description: "Default visibility for new posts.",
            example: "public",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Preferences/#posting-default-visibility",
            },
        }),
        "posting:default:sensitive": Source.shape.sensitive.meta({
            description: "Default sensitivity flag for new posts.",
            example: false,
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Preferences/#posting-default-sensitive",
            },
        }),
        "posting:default:language": Source.shape.language.nullable().meta({
            description: "Default language for new posts.",
            example: null,
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Preferences/#posting-default-language",
            },
        }),
        "reading:expand:media": z
            .enum(["default", "show_all", "hide_all"])
            .meta({
                description:
                    "Whether media attachments should be automatically displayed or blurred/hidden.",
                example: "default",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Preferences/#reading-expand-media",
                },
            }),
        "reading:expand:spoilers": z.boolean().meta({
            description: "Whether CWs should be expanded by default.",
            example: false,
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Preferences/#reading-expand-spoilers",
            },
        }),
    })
    .meta({
        description: "Represents a user's preferences.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Preferences",
        },
        id: "Preferences",
    });
