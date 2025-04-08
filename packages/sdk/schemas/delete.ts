import { z } from "zod";
import { url } from "./common.ts";
import { EntitySchema } from "./entity.ts";

export const DeleteSchema = EntitySchema.extend({
    uri: z.null().optional(),
    type: z.literal("Delete"),
    author: url.nullable(),
    deleted_type: z.string(),
    deleted: url,
});
