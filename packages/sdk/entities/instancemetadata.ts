import type { z } from "zod/v4";
import { InstanceMetadataSchema } from "../schemas/instance.ts";
import type { JSONObject } from "../types.ts";
import { ImageContentFormat } from "./contentformat.ts";
import { Entity } from "./entity.ts";

export class InstanceMetadata extends Entity {
    public static override name = "InstanceMetadata";

    public constructor(
        public override data: z.infer<typeof InstanceMetadataSchema>,
    ) {
        super(data);
    }

    public get logo(): ImageContentFormat | undefined {
        return this.data.logo
            ? new ImageContentFormat(this.data.logo)
            : undefined;
    }

    public get banner(): ImageContentFormat | undefined {
        return this.data.banner
            ? new ImageContentFormat(this.data.banner)
            : undefined;
    }

    public static override fromJSON(
        json: JSONObject,
    ): Promise<InstanceMetadata> {
        return InstanceMetadataSchema.parseAsync(json).then(
            (u) => new InstanceMetadata(u),
        );
    }
}
