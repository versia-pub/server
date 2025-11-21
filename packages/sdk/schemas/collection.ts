import { z } from "zod";
import { u64, url } from "./common.ts";

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
