import { apiRoute, applyConfig } from "@/api";
import { config } from "~/packages/config-manager";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    auth: {
        required: false,
    },
    ratelimits: {
        duration: 60,
        max: 60,
    },
    route: "/.well-known/host-meta",
});

export default apiRoute((app) =>
    app.on(meta.allowedMethods, meta.route, (context) => {
        context.header("Content-Type", "application/xrd+xml");
        return context.body(
            `<?xml version="1.0" encoding="UTF-8"?><XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0"><Link rel="lrdd" template="${new URL(
                "/.well-known/webfinger",
                config.http.base_url,
            ).toString()}?resource={uri}"/></XRD>`,
        );
    }),
);
