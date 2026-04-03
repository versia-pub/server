import type { z } from "zod";
import { DeleteSchema } from "../schemas/delete.ts";
import type { JSONObject } from "../types.ts";
import { Entity, Reference } from "./entity.ts";

export class Delete extends Entity {
    public static override name = "Delete";

    public constructor(
        public override data: z.infer<typeof DeleteSchema>,
        instanceDomain: string,
    ) {
        super(data, instanceDomain);
    }

    public get author(): Reference {
        return Reference.fromString(this.data.author, this.instanceDomain);
    }

    public get deleted(): Reference {
        return Reference.fromString(this.data.deleted, this.instanceDomain);
    }

    public static override fromJSON(
        json: JSONObject,
        instanceDomain: string,
    ): Promise<Delete> {
        return DeleteSchema.parseAsync(json).then(
            (u) => new Delete(u, instanceDomain),
        );
    }
}
