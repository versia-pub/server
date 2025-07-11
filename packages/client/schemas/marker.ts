import { z } from "zod/v4";
import { Id } from "./common.ts";

export const Marker = z
    .object({
        last_read_id: Id.meta({
            description: "The ID of the most recently viewed entity.",
            example: "ead15c9d-8eda-4b2c-9546-ecbf851f001c",
        }),
        version: z.number().meta({
            description:
                "An incrementing counter, used for locking to prevent write conflicts.",
            example: 462,
        }),
        updated_at: z.iso.datetime().meta({
            description: "The timestamp of when the marker was set.",
            example: "2025-01-12T13:11:00Z",
        }),
    })
    .meta({
        description:
            "Represents the last read position within a user's timelines.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Marker",
        },
        id: "Marker",
    });
