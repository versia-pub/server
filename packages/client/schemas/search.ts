import { z } from "zod";
import { Account } from "./account.ts";
import { Status } from "./status.ts";
import { Tag } from "./tag.ts";

export const Search = z
    .object({
        accounts: z.array(Account).meta({
            description: "Accounts which match the given query",
        }),
        statuses: z.array(Status).meta({
            description: "Statuses which match the given query",
        }),
        hashtags: z.array(Tag).meta({
            description: "Hashtags which match the given query",
        }),
    })
    .meta({
        description: "Represents the results of a search.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Search",
        },
        id: "Search",
    });
