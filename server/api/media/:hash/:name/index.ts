import { apiRoute, applyConfig, handleZodError } from "@/api";
import { errorResponse, response } from "@/response";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

export const meta = applyConfig({
    allowedMethods: ["GET"],
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

export default apiRoute((app) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("param", schemas.param, handleZodError),
        zValidator("header", schemas.header, handleZodError),
        async (context) => {
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
                return errorResponse("File not found", 404);
            }

            // Can't directly copy file into Response because this crashes Bun for now
            return response(buffer, 200, {
                "Content-Type": file.type || "application/octet-stream",
                "Content-Length": `${file.size - start}`,
                "Content-Range": `bytes ${start}-${end}/${file.size}`,
            });
        },
    ),
);
