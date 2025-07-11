import { z } from "zod/v4";
import { Id } from "./common.ts";

export const Attachment = z
    .object({
        id: Id.meta({
            description: "The ID of the attachment in the database.",
            example: "8c33d4c6-2292-4f4d-945d-261836e09647",
        }),
        type: z.enum(["unknown", "image", "gifv", "video", "audio"]).meta({
            description:
                "The type of the attachment. 'unknown' = unsupported or unrecognized file type, 'image' = Static image, 'gifv' = Looping, soundless animation, 'video' = Video clip, 'audio' = Audio track.",
            example: "image",
        }),
        url: z.url().meta({
            description: "The location of the original full-size attachment.",
            example:
                "https://files.mastodon.social/media_attachments/files/022/345/792/original/57859aede991da25.jpeg",
        }),
        preview_url: z.url().nullable().meta({
            description:
                "The location of a scaled-down preview of the attachment.",
            example:
                "https://files.mastodon.social/media_attachments/files/022/345/792/small/57859aede991da25.jpeg",
        }),
        remote_url: z.url().nullable().meta({
            description:
                "The location of the full-size original attachment on the remote website, or null if the attachment is local.",
            example: null,
        }),
        meta: z.any().meta({
            description:
                "Metadata. May contain subtrees like 'small' and 'original', and possibly a 'focus' object for smart thumbnail cropping.",
            example: {
                original: {
                    width: 640,
                    height: 480,
                    size: "640x480",
                    aspect: 1.3333333333333333,
                },
                small: {
                    width: 461,
                    height: 346,
                    size: "461x346",
                    aspect: 1.3323699421965318,
                },
                focus: {
                    x: -0.27,
                    y: 0.51,
                },
            },
        }),
        description: z.string().trim().nullable().meta({
            description:
                "Alternate text that describes what is in the media attachment, to be used for the visually impaired or when media attachments do not load.",
            example: "test media description",
        }),
        blurhash: z.string().nullable().meta({
            description:
                "A hash computed by the BlurHash algorithm, for generating colorful preview thumbnails when media has not been downloaded yet.",
            example: "UFBWY:8_0Jxv4mx]t8t64.%M-:IUWGWAt6M}",
        }),
    })
    .meta({
        description:
            "Represents a file or media attachment that can be added to a status.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Attachment",
        },
        id: "Attachment",
    });
