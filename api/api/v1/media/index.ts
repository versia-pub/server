import { apiRoute, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Attachment } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import sharp from "sharp";
import { z } from "zod";
import { ApiError } from "~/classes/errors/api-error";
import { MediaManager } from "~/classes/media/media-manager";
import { config } from "~/packages/config-manager/index.ts";
import { ErrorSchema } from "~/types/api";

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
    middleware: [
        auth({
            auth: true,
            scopes: ["write:media"],
            permissions: [RolePermissions.ManageOwnMedia],
        }),
    ] as const,
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
            throw new ApiError(
                413,
                `File too large, max size is ${config.validation.max_media_size} bytes`,
            );
        }

        if (
            config.validation.enforce_mime_types &&
            !config.validation.allowed_mime_types.includes(file.type)
        ) {
            throw new ApiError(
                415,
                `File type ${file.type} is not allowed`,
                `Allowed types: ${config.validation.allowed_mime_types.join(", ")}`,
            );
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
