import { z } from "zod";
import { Account } from "./account.ts";

export const FamiliarFollowers = z
    .object({
        id: Account.shape.id.meta({
            description: "The ID of the Account in the database.",
            example: "48214efb-1f3c-459a-abfa-618a5aeb2f7a",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/FamiliarFollowers/#id",
            },
        }),
        accounts: z.array(Account).meta({
            description: "Accounts you follow that also follow this account.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/FamiliarFollowers/#accounts",
            },
        }),
    })
    .meta({
        description:
            "Represents a subset of your follows who also follow some other user.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/FamiliarFollowers",
        },
        id: "FamiliarFollowers",
    });
