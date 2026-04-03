import { EntitySchema } from "../schemas/entity.ts";
import type { JSONObject } from "../types.ts";

export class Entity {
    public static name = "Entity";

    public constructor(
        // biome-ignore lint/suspicious/noExplicitAny: This is a base class that is never instanciated directly
        public data: any,
        public instanceDomain: string,
    ) {}

    public static fromJSON(
        json: JSONObject,
        instanceDomain: string,
    ): Promise<Entity> {
        return EntitySchema.parseAsync(json).then(
            (u) => new Entity(u, instanceDomain),
        );
    }

    public toJSON(): JSONObject {
        return this.data;
    }
}

export class Reference {
    public constructor(
        public id: string,
        public domain: string,
    ) {}

    /**
     * Parses a reference from a string. The string can be in the format "domain:id" or just "id" if the domain is the local instance (in which case a default domain must be provided).
     * @param str
     * @param defaultDomain
     * @returns
     */
    public static fromString(
        str: string,
        defaultDomain: URL | string,
    ): Reference {
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

        if (!defaultDomain) {
            throw new Error(
                `Invalid reference string: ${str}. Expected format "domain:id" or "id" with a default domain provided.`,
            );
        }

        return new Reference(
            str,
            defaultDomain instanceof URL
                ? defaultDomain.hostname
                : defaultDomain,
        );
    }

    public toString(): string {
        return `${this.domain}:${this.id}`;
    }
}
