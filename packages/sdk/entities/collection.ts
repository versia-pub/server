import type { z } from "zod";
import {
    CollectionSchema,
    URICollectionSchema,
} from "../schemas/collection.ts";
import type { JSONObject } from "../types.ts";
import { Entity } from "./entity.ts";

export class Collection extends Entity {
    public constructor(public data: z.infer<typeof CollectionSchema>) {
        super(data);
    }

    public static fromJSON(json: JSONObject): Promise<Collection> {
        return CollectionSchema.parseAsync(json).then((u) => new Collection(u));
    }
}

export class URICollection extends Entity {
    public constructor(public data: z.infer<typeof URICollectionSchema>) {
        super(data);
    }

    public static fromJSON(json: JSONObject): Promise<URICollection> {
        return URICollectionSchema.parseAsync(json).then(
            (u) => new URICollection(u),
        );
    }
}
