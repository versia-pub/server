import type { z } from "zod/v4";
import {
    AudioContentFormatSchema,
    ContentFormatSchema,
    ImageContentFormatSchema,
    NonTextContentFormatSchema,
    TextContentFormatSchema,
    VideoContentFormatSchema,
} from "../schemas/contentformat.ts";
import type { JSONObject } from "../types.ts";

export class ContentFormat {
    public static fromJSON(data: JSONObject): Promise<ContentFormat> {
        return ContentFormatSchema.parseAsync(data).then(
            (d) => new ContentFormat(d),
        );
    }

    public constructor(public data: z.infer<typeof ContentFormatSchema>) {}
}

export class TextContentFormat extends ContentFormat {
    public static override fromJSON(
        data: JSONObject,
    ): Promise<TextContentFormat> {
        return TextContentFormatSchema.parseAsync(data).then(
            (d) => new TextContentFormat(d),
        );
    }

    public constructor(
        public override data: z.infer<typeof TextContentFormatSchema>,
    ) {
        super(data);
    }
}

export class NonTextContentFormat extends ContentFormat {
    public static override fromJSON(
        data: JSONObject,
    ): Promise<NonTextContentFormat> {
        return NonTextContentFormatSchema.parseAsync(data).then(
            (d) => new NonTextContentFormat(d),
        );
    }

    public constructor(
        public override data: z.infer<typeof NonTextContentFormatSchema>,
    ) {
        super(data);
    }
}

export class ImageContentFormat extends ContentFormat {
    public static override fromJSON(
        data: JSONObject,
    ): Promise<ImageContentFormat> {
        return ImageContentFormatSchema.parseAsync(data).then(
            (d) => new ImageContentFormat(d),
        );
    }

    public constructor(
        public override data: z.infer<typeof ImageContentFormatSchema>,
    ) {
        super(data);
    }
}

export class VideoContentFormat extends ContentFormat {
    public static override fromJSON(
        data: JSONObject,
    ): Promise<VideoContentFormat> {
        return VideoContentFormatSchema.parseAsync(data).then(
            (d) => new VideoContentFormat(d),
        );
    }

    public constructor(
        public override data: z.infer<typeof VideoContentFormatSchema>,
    ) {
        super(data);
    }
}

export class AudioContentFormat extends ContentFormat {
    public static override fromJSON(
        data: JSONObject,
    ): Promise<AudioContentFormat> {
        return AudioContentFormatSchema.parseAsync(data).then(
            (d) => new AudioContentFormat(d),
        );
    }

    public constructor(
        public override data: z.infer<typeof AudioContentFormatSchema>,
    ) {
        super(data);
    }
}
