import { z } from "zod/v4";

export const Token = z
    .object({
        access_token: z.string().meta({
            description: "An OAuth token to be used for authorization.",
            example: "ZA-Yj3aBD8U8Cm7lKUp-lm9O9BmDgdhHzDeqsY8tlL0",
        }),
        token_type: z.string().meta({
            description: "The OAuth token type. Versia uses Bearer tokens.",
            example: "Bearer",
        }),
        scope: z.string().meta({
            description:
                "The OAuth scopes granted by this token, space-separated.",
            example: "read write follow push",
        }),
        created_at: z.number().nonnegative().meta({
            description: "When the token was generated. UNIX timestamp.",
            example: 1573979017,
        }),
    })
    .meta({
        description:
            "Represents an OAuth token used for authenticating with the API and performing actions.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Token",
        },
        id: "Token",
    });
