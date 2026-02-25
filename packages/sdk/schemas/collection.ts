import { z } from "zod";
import { u64 } from "./common.ts";
import { ReferenceSchema } from "./entity.ts";

export const CollectionSchema = z.strictObject({
    author: ReferenceSchema.nullable(),
    total: u64,
    items: z.array(z.any()),
});

export const URICollectionSchema = CollectionSchema.extend({
    items: z.array(ReferenceSchema),
});
