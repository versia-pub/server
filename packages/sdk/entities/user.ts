import type { z } from "zod/v4";
import { UserSchema } from "../schemas/user.ts";
import type { JSONObject } from "../types.ts";
import { ImageContentFormat, TextContentFormat } from "./contentformat.ts";
import { Entity } from "./entity.ts";

export class User extends Entity {
    public static override name = "User";

    public constructor(public override data: z.infer<typeof UserSchema>) {
        super(data);
    }

    public static override fromJSON(json: JSONObject): Promise<User> {
        return UserSchema.parseAsync(json).then((u) => new User(u));
    }

    public get avatar(): ImageContentFormat | undefined {
        return this.data.avatar
            ? new ImageContentFormat(this.data.avatar)
            : undefined;
    }

    public get header(): ImageContentFormat | undefined {
        return this.data.header
            ? new ImageContentFormat(this.data.header)
            : undefined;
    }

    public get bio(): TextContentFormat | undefined {
        return this.data.bio ? new TextContentFormat(this.data.bio) : undefined;
    }
}
