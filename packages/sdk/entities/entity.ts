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

export class Reference {
    public constructor(
        public id: string,
        public domain?: string,
    ) {}

    public static fromString(str: string): Reference {
        // Expect format: domain:id or id (if domain is the local instance)
        // Handle IPv6 addresses in brackets
        const chunks = str.split(":");
        if (chunks.length === 2) {
            return new Reference(chunks[1], chunks[0]);
        }

        if (chunks.length > 2) {
            const domain = chunks.slice(0, -1).join(":");
            const id = chunks.at(-1) as string;
            return new Reference(id, domain);
        }

        return new Reference(str);
    }

    public toString(): string {
        return this.domain ? `${this.domain}:${this.id}` : this.id;
    }
}
