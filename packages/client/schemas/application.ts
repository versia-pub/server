import { z } from "zod/v4";

export const Application = z
    .object({
        name: z
            .string()
            .trim()
            .min(1)
            .max(200)
            .meta({
                description: "The name of your application.",
                example: "Test Application",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Application/#name",
                },
            }),
        website: z
            .string()
            .nullable()
            .meta({
                description: "The website associated with your application.",
                example: "https://app.example",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Application/#website",
                },
            }),
        scopes: z
            .array(z.string())
            .default(["read"])
            .meta({
                description:
                    "The scopes for your application. This is the registered scopes string split on whitespace.",
                example: ["read", "write", "push"],
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Application/#scopes",
                },
            }),
        redirect_uris: z
            .array(
                z.url().or(z.literal("urn:ietf:wg:oauth:2.0:oob")).meta({
                    description: "URL or 'urn:ietf:wg:oauth:2.0:oob'",
                }),
            )
            .meta({
                description:
                    "The registered redirection URI(s) for your application.",
                externalDocs: {
                    url: "https://docs.joinmastodon.org/entities/Application/#redirect_uris",
                },
            }),
        redirect_uri: z.string().meta({
            deprecated: true,
            description:
                "The registered redirection URI(s) for your application. May contain \\n characters when multiple redirect URIs are registered.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Application/#redirect_uri",
            },
        }),
    })
    .meta({
        id: "Application",
    });

export const CredentialApplication = Application.extend({
    client_id: z.string().meta({
        description: "Client ID key, to be used for obtaining OAuth tokens",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/CredentialApplication/#client_id",
        },
    }),
    client_secret: z.string().meta({
        description: "Client secret key, to be used for obtaining OAuth tokens",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/CredentialApplication/#client_secret",
        },
    }),
    client_secret_expires_at: z.string().meta({
        description:
            "When the client secret key will expire at, presently this always returns 0 indicating that OAuth Clients do not expire",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/CredentialApplication/#client_secret_expires_at",
        },
    }),
}).meta({
    id: "CredentialApplication",
});
