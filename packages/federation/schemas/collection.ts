import { z } from "zod";
import { url, u64 } from "./common.ts";

export const CollectionSchema = z.strictObject({
    author: url.nullable(),
    first: url,
    last: url,
    total: u64,
    next: url.nullable(),
    previous: url.nullable(),
    items: z.array(z.any()),
});

export const URICollectionSchema = CollectionSchema.extend({
    items: z.array(url),
});
