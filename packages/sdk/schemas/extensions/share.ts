import { z } from "zod";
import { url } from "../common.ts";
import { EntitySchema } from "../entity.ts";

export const ShareSchema = EntitySchema.extend({
    type: z.literal("pub.versia:share/Share"),
    author: url,
    shared: url,
});
