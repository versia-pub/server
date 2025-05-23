import type { z } from "zod";
import { NoteSchema } from "../schemas/note.ts";
import type { JSONObject } from "../types.ts";
import { NonTextContentFormat, TextContentFormat } from "./contentformat.ts";
import { Entity } from "./entity.ts";

export class Note extends Entity {
    public static override name = "Note";

    public constructor(public override data: z.infer<typeof NoteSchema>) {
        super(data);
    }

    public static override fromJSON(json: JSONObject): Promise<Note> {
        return NoteSchema.parseAsync(json).then((n) => new Note(n));
    }

    public get attachments(): NonTextContentFormat[] {
        return (
            this.data.attachments?.map((a) => new NonTextContentFormat(a)) ?? []
        );
    }

    public get content(): TextContentFormat | undefined {
        return this.data.content
            ? new TextContentFormat(this.data.content)
            : undefined;
    }
}
