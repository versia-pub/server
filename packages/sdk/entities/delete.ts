import type { z } from "zod/v4";
import { DeleteSchema } from "../schemas/delete.ts";
import type { JSONObject } from "../types.ts";
import { Entity } from "./entity.ts";

export class Delete extends Entity {
    public static override name = "Delete";

    public constructor(public override data: z.infer<typeof DeleteSchema>) {
        super(data);
    }

    public static override fromJSON(json: JSONObject): Promise<Delete> {
        return DeleteSchema.parseAsync(json).then((u) => new Delete(u));
    }
}
