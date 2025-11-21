import { z } from "zod/v4";
import { Id } from "./common.ts";
import { RolePermission } from "./permissions.ts";

/* Versia Server API extension */
export const Role = z
    .object({
        id: Id.meta({
            description: "The role ID in the database.",
            example: "b4a7e0f0-8f6a-479b-910b-9265c070d5bd",
        }),
        name: z.string().min(1).max(128).trim().meta({
            description: "The name of the role.",
            example: "Moderator",
        }),
        permissions: z.array(z.enum(RolePermission)).meta({
            description: "The permissions granted to the role.",
            example: [
                RolePermission.ManageEmojis,
                RolePermission.ManageAccounts,
            ],
        }),
        priority: z.number().int().meta({
            description:
                "Role priority. Higher priority roles allow overriding lower priority roles.",
            example: 100,
        }),
        description: z.string().min(0).max(1024).trim().optional().meta({
            description: "Short role description.",
            example: "Allows managing emojis and accounts.",
        }),
        visible: z.boolean().default(true).meta({
            description: "Whether the role should be shown in the UI.",
        }),
        icon: z.url().optional().meta({
            description: "URL to the role icon.",
            example: "https://example.com/role-icon.png",
        }),
    })
    .meta({
        description:
            "Information about a role in the system, as well as its permissions.",
        id: "Role",
    });

/* Versia Server API extension */
export const NoteReaction = z
    .object({
        name: z.string().min(1).trim().meta({
            description: "Custom Emoji shortcode or Unicode emoji.",
            example: "blobfox_coffee",
        }),
        count: z.number().int().nonnegative().meta({
            description: "Number of users who reacted with this emoji.",
            example: 5,
        }),
        remote: z.boolean().meta({
            description:
                "Whether this reaction is from a remote instance (federated).",
            example: false,
        }),
        me: z.boolean().optional().meta({
            description:
                "Whether the current authenticated user reacted with this emoji.",
            example: true,
        }),
    })
    .meta({
        description: "Information about a reaction to a note.",
        id: "NoteReaction",
    });

/* Versia Server API extension */
export const NoteReactionWithAccounts = NoteReaction.extend({
    account_ids: z.array(Id).meta({
        description: "Array of user IDs who reacted with this emoji.",
        example: [
            "1d0185bc-d949-4ff5-8a15-1d691b256489",
            "d9de4aeb-4591-424d-94ec-659f958aa23d",
            "1f0c4eb9-a742-4c82-96c9-697a39831cd1",
        ],
    }),
}).meta({
    description: "Information about a reaction to a note with account IDs.",
    id: "NoteReactionWithAccounts",
});

/* Versia Server API extension */
export const SSOConfig = z.object({
    providers: z
        .array(
            z.object({
                id: z.string().min(1).meta({
                    description: "The ID of the provider.",
                    example: "google",
                }),
                name: z.string().min(1).meta({
                    description: "Human-readable provider name.",
                    example: "Google",
                }),
                icon: z.url().optional().meta({
                    description: "URL to the provider icon.",
                    example: "https://cdn.versia.social/google-icon.png",
                }),
            }),
        )
        .meta({
            description:
                "An array of external OpenID Connect providers that users can link their accounts to.",
        }),
});

/* Versia Server API extension */
export const Challenge = z
    .object({
        id: Id.meta({}).meta({
            description: "Challenge ID in the database.",
            example: "b4a7e0f0-8f6a-479b-910b-9265c070d5bd",
        }),
        algorithm: z.enum(["SHA-1", "SHA-256", "SHA-512"]).meta({
            description: "Algorithm used to generate the challenge.",
            example: "SHA-1",
        }),
        challenge: z.string().meta({
            description: "Challenge to solve.",
            example: "1234567890",
        }),
        maxnumber: z.number().int().nonnegative().optional().meta({
            description: "Maximum number to solve the challenge.",
            example: 100,
        }),
        salt: z.string().meta({
            description: "Salt used to generate the challenge.",
            example: "1234567890",
        }),
        signature: z.string().meta({
            description: "Signature of the challenge.",
            example: "1234567890",
        }),
    })
    .meta({
        description: "A cryptographic challenge to solve. Used for Captchas.",
        id: "Challenge",
    });
