import { z } from "@hono/zod-openapi";
import { RolePermission } from "@versia/client/types";
import { config } from "~/config.ts";
import { Id } from "./common.ts";

/* Versia Server API extension */
export const Role = z
    .object({
        id: Id.openapi({}).openapi({
            description: "The role ID in the database.",
            example: "b4a7e0f0-8f6a-479b-910b-9265c070d5bd",
        }),
        name: z.string().min(1).max(128).trim().openapi({
            description: "The name of the role.",
            example: "Moderator",
        }),
        permissions: z
            .array(z.nativeEnum(RolePermission))
            .transform(
                // Deduplicate permissions
                (permissions) => Array.from(new Set(permissions)),
            )
            .default([])
            .openapi({
                description: "The permissions granted to the role.",
                example: [
                    RolePermission.ManageEmojis,
                    RolePermission.ManageAccounts,
                ],
            }),
        priority: z.number().int().default(0).openapi({
            description:
                "Role priority. Higher priority roles allow overriding lower priority roles.",
            example: 100,
        }),
        description: z.string().min(0).max(1024).trim().optional().openapi({
            description: "Short role description.",
            example: "Allows managing emojis and accounts.",
        }),
        visible: z.boolean().default(true).openapi({
            description: "Whether the role should be shown in the UI.",
        }),
        icon: z.string().url().optional().openapi({
            description: "URL to the role icon.",
            example: "https://example.com/role-icon.png",
        }),
    })
    .openapi({
        description:
            "Information about a role in the system, as well as its permissions.",
    });

/* Versia Server API extension */
export const NoteReaction = z
    .object({
        name: z
            .string()
            .min(1)
            .max(config.validation.emojis.max_shortcode_characters)
            .trim()
            .openapi({
                description: "Custom Emoji shortcode or Unicode emoji.",
                example: "blobfox_coffee",
            }),
        count: z.number().int().nonnegative().openapi({
            description: "Number of users who reacted with this emoji.",
            example: 5,
        }),
        me: z.boolean().optional().openapi({
            description:
                "Whether the current authenticated user reacted with this emoji.",
            example: true,
        }),
    })
    .openapi({
        description: "Information about a reaction to a note.",
    });

/* Versia Server API extension */
export const SSOConfig = z.object({
    forced: z.boolean().openapi({
        description:
            "If this is enabled, normal identifier/password login is disabled and login must be done through SSO.",
        example: false,
    }),
    providers: z
        .array(
            z.object({
                id: z.string().min(1).openapi({
                    description: "The ID of the provider.",
                    example: "google",
                }),
                name: z.string().min(1).openapi({
                    description: "Human-readable provider name.",
                    example: "Google",
                }),
                icon: z.string().url().optional().openapi({
                    description: "URL to the provider icon.",
                    example: "https://cdn.versia.social/google-icon.png",
                }),
            }),
        )
        .openapi({
            description:
                "An array of external OpenID Connect providers that users can link their accounts to.",
        }),
});
