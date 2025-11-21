import { z } from "zod";

export const TermsOfService = z
    .object({
        updated_at: z.iso.datetime().meta({
            description: "A timestamp of when the ToS was last updated.",
            example: "2025-01-12T13:11:00Z",
        }),
        content: z.string().meta({
            description: "The rendered HTML content of the ToS.",
            example: "<p><h1>ToS</h1><p>None, have fun.</p></p>",
        }),
    })
    .meta({
        description: "Represents the ToS of the instance.",
        id: "TermsOfService",
    });
