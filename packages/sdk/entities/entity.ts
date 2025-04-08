import { EntitySchema } from "../schemas/entity.ts";
import type { JSONObject } from "../types.ts";

export class Entity {
    public static name = "Entity";

    // biome-ignore lint/suspicious/noExplicitAny: This is a base class that is never instanciated directly
    public constructor(public data: any) {}

    public static fromJSON(json: JSONObject): Promise<Entity> {
        return EntitySchema.parseAsync(json).then((u) => new Entity(u));
    }

    public toJSON(): JSONObject {
        return this.data;
    }
}
