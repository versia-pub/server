import { z } from "@hono/zod-openapi";
import { Account } from "./account.ts";
import { Status } from "./status.ts";
import { Tag } from "./tag.ts";

export const Search = z
    .object({
        accounts: z.array(Account).openapi({
            description: "Accounts which match the given query",
        }),
        statuses: z.array(Status).openapi({
            description: "Statuses which match the given query",
        }),
        hashtags: z.array(Tag).openapi({
            description: "Hashtags which match the given query",
        }),
    })
    .openapi("Search", {
        description: "Represents the results of a search.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Search",
        },
    });
