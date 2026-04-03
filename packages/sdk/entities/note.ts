import type { z } from "zod";
import { NoteSchema } from "../schemas/note.ts";
import type { JSONObject } from "../types.ts";
import { NonTextContentFormat, TextContentFormat } from "./contentformat.ts";
import { Entity, Reference } from "./entity.ts";

export class Note extends Entity {
    public static override name = "Note";

    public constructor(
        public override data: z.infer<typeof NoteSchema>,
        instanceDomain: string,
    ) {
        super(data, instanceDomain);
    }

    public static override fromJSON(
        json: JSONObject,
        instanceDomain: string,
    ): Promise<Note> {
        return NoteSchema.parseAsync(json).then(
            (n) => new Note(n, instanceDomain),
        );
    }

    public get author(): Reference {
        return Reference.fromString(this.data.author, this.instanceDomain);
    }

    public get group(): Reference | null {
        if (
            !this.data.group ||
            ["public", "followers"].includes(this.data.group)
        ) {
            return null;
        }

        return Reference.fromString(this.data.group, this.instanceDomain);
    }

    public get mentions(): Reference[] {
        return this.data.mentions.map((m) =>
            Reference.fromString(m, this.instanceDomain),
        );
    }

    public get quotes(): Reference | null {
        return this.data.quotes
            ? Reference.fromString(this.data.quotes, this.instanceDomain)
            : null;
    }

    public get repliesTo(): Reference | null {
        return this.data.replies_to
            ? Reference.fromString(this.data.replies_to, this.instanceDomain)
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
