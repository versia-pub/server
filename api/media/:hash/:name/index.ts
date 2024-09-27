import { apiRoute, applyConfig } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    route: "/media/:hash/:name",
    ratelimits: {
        max: 100,
        duration: 60,
    },
    auth: {
        required: false,
    },
});

export const schemas = {
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
            return context.json({ error: "File not found" }, 404);
        }

        // Can't directly copy file into Response because this crashes Bun for now
        return context.newResponse(buffer, 200, {
            "Content-Type": file.type || "application/octet-stream",
            "Content-Length": `${file.size - start}`,
            "Content-Range": `bytes ${start}-${end}/${file.size}`,
            // biome-ignore lint/suspicious/noExplicitAny: Hono doesn't type this response so this has a TS error
        }) as any;
    }),
);
