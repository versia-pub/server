import { z } from "@hono/zod-openapi";
import { Account } from "./account.ts";

export const FamiliarFollowers = z
    .object({
        id: Account.shape.id.openapi({
            description: "The ID of the Account in the database.",
            example: "48214efb-1f3c-459a-abfa-618a5aeb2f7a",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/FamiliarFollowers/#id",
            },
        }),
        accounts: z.array(Account).openapi({
            description: "Accounts you follow that also follow this account.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/FamiliarFollowers/#accounts",
            },
        }),
    })
    .openapi({
        description:
            "Represents a subset of your follows who also follow some other user.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/FamiliarFollowers",
        },
    });
