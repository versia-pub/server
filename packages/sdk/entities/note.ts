import type { z } from "zod";
import { NoteSchema } from "../schemas/note.ts";
import type { JSONObject } from "../types.ts";
import { NonTextContentFormat, TextContentFormat } from "./contentformat.ts";
import { Entity, Reference } from "./entity.ts";

export class Note extends Entity {
    public static override name = "Note";

    public constructor(public override data: z.infer<typeof NoteSchema>) {
        super(data);
    }

    public static override fromJSON(json: JSONObject): Promise<Note> {
        return NoteSchema.parseAsync(json).then((n) => new Note(n));
    }

    public get author(): Reference {
        return Reference.fromString(this.data.author);
    }

    public get group(): Reference | null {
        if (
            !this.data.group ||
            ["public", "followers"].includes(this.data.group)
        ) {
            return null;
        }

        return Reference.fromString(this.data.group);
    }

    public get mentions(): Reference[] {
        return this.data.mentions.map((m) => Reference.fromString(m));
    }

    public get quotes(): Reference | null {
        return this.data.quotes ? Reference.fromString(this.data.quotes) : null;
    }

    public get repliesTo(): Reference | null {
        return this.data.replies_to
            ? Reference.fromString(this.data.replies_to)
            : null;
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
