import { config } from "@versia-server/config";
import { apiRoute } from "@versia-server/kit/api";
import { describeRoute, resolver } from "hono-openapi";
import { z } from "zod/v4";

export default apiRoute((app) =>
    app.get(
        "/.well-known/host-meta",
        describeRoute({
            summary: "Well-known host-meta",
            tags: ["Federation"],
            responses: {
                200: {
                    description: "Host-meta",
                    content: {
                        "application/xrd+xml": {
                            schema: resolver(z.any()),
                        },
                    },
                },
            },
        }),
        (context) => {
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
        },
    ),
);
