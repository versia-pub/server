import { apiRoute } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { config } from "~/config.ts";

const route = createRoute({
    method: "get",
    path: "/.well-known/host-meta",
    summary: "Well-known host-meta",
    tags: ["Federation"],
    responses: {
        200: {
            description: "Host-meta",
            content: {
                "application/xrd+xml": {
                    schema: z.any(),
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, (context) => {
        context.header("Content-Type", "application/xrd+xml");
        context.status(200);

        return context.body(
            `<?xml version="1.0" encoding="UTF-8"?><XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0"><Link rel="lrdd" template="${new URL(
                "/.well-known/webfinger",
                config.http.base_url,
            ).toString()}?resource={uri}"/></XRD>`,
            200,
            // biome-ignore lint/suspicious/noExplicitAny: Hono doesn't type this response so this has a TS error, it's joever
        ) as any;
    }),
);
