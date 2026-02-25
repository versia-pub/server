import { z } from "zod";
import { EntitySchema, ReferenceSchema } from "../entity.ts";

export const ShareSchema = EntitySchema.extend({
    type: z.literal("pub.versia:share/Share"),
    author: ReferenceSchema,
    shared: ReferenceSchema,
});
