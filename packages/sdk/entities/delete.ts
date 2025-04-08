import type { z } from "zod";
import { DeleteSchema } from "../schemas/delete.ts";
import type { JSONObject } from "../types.ts";
import { Entity } from "./entity.ts";

export class Delete extends Entity {
    public static name = "Delete";

    public constructor(public data: z.infer<typeof DeleteSchema>) {
        super(data);
    }

    public static fromJSON(json: JSONObject): Promise<Delete> {
        return DeleteSchema.parseAsync(json).then((u) => new Delete(u));
    }
}
