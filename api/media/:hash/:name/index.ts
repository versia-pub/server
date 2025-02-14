import { apiRoute } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { ApiError } from "~/classes/errors/api-error";
import { ErrorSchema } from "~/types/api";

const schemas = {
    param: z.object({
        hash: z.string(),
        name: z.string(),
    }),
    header: z.object({
        range: z.string().optional().default(""),
    }),
};

const route = createRoute({
    method: "get",
    path: "/media/{hash}/{name}",
    summary: "Get media file by hash and name",
    request: {
        params: schemas.param,
        headers: schemas.header,
    },
    responses: {
        200: {
            description: "Media",
            content: {
                "*": {
                    schema: z.any(),
                },
            },
        },
        404: {
            description: "File not found",
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
        const { hash, name } = context.req.valid("param");
        const { range } = context.req.valid("header");

        // parse `Range` header
        const [start = 0, end = Number.POSITIVE_INFINITY] = (
            range
                .split("=") // ["Range: bytes", "0-100"]
                .at(-1) || ""
        ) // "0-100"
            .split("-") // ["0", "100"]
            .map(Number); // [0, 100]

        // Serve file from filesystem
        const file = Bun.file(`./uploads/${hash}/${name}`);

        const buffer = await file.arrayBuffer();

        if (!(await file.exists())) {
            throw new ApiError(404, "File not found");
        }

        // Can't directly copy file into Response because this crashes Bun for now
        return context.body(buffer, 200, {
            "Content-Type": file.type || "application/octet-stream",
            "Content-Length": `${file.size - start}`,
            "Content-Range": `bytes ${start}-${end}/${file.size}`,
            // biome-ignore lint/suspicious/noExplicitAny: Hono doesn't type this response so this has a TS error
        }) as any;
    }),
);
