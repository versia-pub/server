import { z } from "zod";
import { Status } from "./status.ts";

export const Context = z
    .object({
        ancestors: z.array(Status).meta({
            description: "Parents in the thread.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Context/#ancestors",
            },
        }),
        descendants: z.array(Status).meta({
            description: "Children in the thread.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/entities/Context/#descendants",
            },
        }),
    })
    .meta({
        description:
            "Represents the tree around a given status. Used for reconstructing threads of statuses.",
        externalDocs: {
            url: "https://docs.joinmastodon.org/entities/Context/#context",
        },
        id: "Context",
    });
