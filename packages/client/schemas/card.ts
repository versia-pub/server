import { z } from "zod";
import { Account } from "./account.ts";

export const PreviewCardAuthor = z
    .object({
        name: z.string().openapi({
            description: "The original resource author’s name.",
            example: "The Doubleclicks",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/PreviewCardAuthor/#name",
            },
        }),
        url: z
            .string()
            .url()
            .openapi({
                description: "A link to the author of the original resource.",
                example: "https://www.youtube.com/user/thedoubleclicks",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/PreviewCardAuthor/#url",
                },
            }),
        account: Account.nullable().openapi({
            description: "The fediverse account of the author.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/PreviewCardAuthor/#account",
            },
        }),
    })
    .openapi({
        ref: "PreviewCardAuthor",
    });

export const PreviewCard = z
    .object({
        url: z
            .string()
            .url()
            .openapi({
                description: "Location of linked resource.",
                example: "https://www.youtube.com/watch?v=OMv_EPMED8Y",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/PreviewCard/#url",
                },
            }),
        title: z
            .string()
            .min(1)
            .openapi({
                description: "Title of linked resource.",
                example: "♪ Brand New Friend (Christmas Song!)",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/PreviewCard/#title",
                },
            }),
        description: z.string().openapi({
            description: "Description of preview.",
            example: "",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/PreviewCard/#description",
            },
        }),
        type: z.enum(["link", "photo", "video"]).openapi({
            description: "The type of the preview card.",
            example: "video",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/PreviewCard/#type",
            },
        }),
        authors: z.array(PreviewCardAuthor).openapi({
            description:
                "Fediverse account of the authors of the original resource.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/PreviewCard/#authors",
            },
        }),
        provider_name: z.string().openapi({
            description: "The provider of the original resource.",
            example: "YouTube",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/PreviewCard/#provider_name",
            },
        }),
        provider_url: z
            .string()
            .url()
            .openapi({
                description: "A link to the provider of the original resource.",
                example: "https://www.youtube.com/",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/PreviewCard/#provider_url",
                },
            }),
        html: z.string().openapi({
            description: "HTML to be used for generating the preview card.",
            example:
                '<iframe width="480" height="270" src="https://www.youtube.com/embed/OMv_EPMED8Y?feature=oembed" frameborder="0" allowfullscreen=""></iframe>',
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/PreviewCard/#html",
            },
        }),
        width: z
            .number()
            .int()
            .openapi({
                description: "Width of preview, in pixels.",
                example: 480,
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/PreviewCard/#width",
                },
            }),
        height: z
            .number()
            .int()
            .openapi({
                description: "Height of preview, in pixels.",
                example: 270,
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/PreviewCard/#height",
                },
            }),
        image: z
            .string()
            .url()
            .nullable()
            .openapi({
                description: "Preview thumbnail.",
                example:
                    "https://cdn.versia.social/preview_cards/images/014/179/145/original/9cf4b7cf5567b569.jpeg",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/PreviewCard/#image",
                },
            }),
        embed_url: z
            .string()
            .url()
            .openapi({
                description: "Used for photo embeds, instead of custom html.",
                example:
                    "https://live.staticflickr.com/65535/49088768431_6a4322b3bb_b.jpg",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/PreviewCard/#embed_url",
                },
            }),
        blurhash: z
            .string()
            .nullable()
            .openapi({
                description:
                    "A hash computed by the BlurHash algorithm, for generating colorful preview thumbnails when media has not been downloaded yet.",
                example: "UvK0HNkV,:s9xBR%njog0fo2W=WBS5ozofV@",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/PreviewCard/#blurhash",
                },
            }),
    })
    .openapi({
        description:
            "Represents a rich preview card that is generated using OpenGraph tags from a URL.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/PreviewCard",
        },
        ref: "PreviewCard",
    });
