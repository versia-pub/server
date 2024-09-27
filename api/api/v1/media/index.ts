import { apiRoute, applyConfig, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import sharp from "sharp";
import { z } from "zod";
import { MediaManager } from "~/classes/media/media-manager";
import { RolePermissions } from "~/drizzle/schema";
import { config } from "~/packages/config-manager/index";
import { Attachment } from "~/packages/database-interface/attachment";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    ratelimits: {
        max: 10,
        duration: 60,
    },
    route: "/api/v1/media",
    auth: {
        required: true,
        oauthPermissions: ["write:media"],
    },
    permissions: {
        required: [RolePermissions.ManageOwnMedia],
    },
});

export const schemas = {
    form: z.object({
        file: z.instanceof(File),
        thumbnail: z.instanceof(File).optional(),
        description: z
            .string()
            .max(config.validation.max_media_description_size)
            .optional(),
        focus: z.string().optional(),
    }),
};

const route = createRoute({
    method: "post",
    path: "/api/v1/media",
    summary: "Upload media",
    middleware: [auth(meta.auth, meta.permissions)],
    request: {
        body: {
            content: {
                "multipart/form-data": {
                    schema: schemas.form,
                },
            },
        },
    },
    responses: {
        200: {
            description: "Attachment",
            content: {
                "application/json": {
                    schema: Attachment.schema,
                },
            },
        },
        401: {
            description: "Unauthorized",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        413: {
            description: "File too large",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        415: {
            description: "Disallowed file type",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { file, thumbnail, description } = context.req.valid("form");

        if (file.size > config.validation.max_media_size) {
            return context.json(
                {
                    error: `File too large, max size is ${config.validation.max_media_size} bytes`,
                },
                413,
            );
        }

        if (
            config.validation.enforce_mime_types &&
            !config.validation.allowed_mime_types.includes(file.type)
        ) {
            return context.json({ error: "Disallowed file type" }, 415);
        }

        const sha256 = new Bun.SHA256();

        const isImage = file.type.startsWith("image/");

        const metadata = isImage
            ? await sharp(await file.arrayBuffer()).metadata()
            : null;

        const mediaManager = new MediaManager(config);

        const { path, blurhash } = await mediaManager.addFile(file);

        const url = Attachment.getUrl(path);

        let thumbnailUrl = "";

        if (thumbnail) {
            const { path } = await mediaManager.addFile(thumbnail);

            thumbnailUrl = Attachment.getUrl(path);
        }

        const newAttachment = await Attachment.insert({
            url,
            thumbnailUrl,
            sha256: sha256.update(await file.arrayBuffer()).digest("hex"),
            mimeType: file.type,
            description: description ?? "",
            size: file.size,
            blurhash: blurhash ?? undefined,
            width: metadata?.width ?? undefined,
            height: metadata?.height ?? undefined,
        });

        // TODO: Add job to process videos and other media

        return context.json(newAttachment.toApi(), 200);
    }),
);
