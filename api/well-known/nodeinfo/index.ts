import { apiRoute, applyConfig } from "@/api";
import { redirect } from "@/response";
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
    route: "/.well-known/nodeinfo",
});

export default apiRoute((app) =>
    app.on(meta.allowedMethods, meta.route, () => {
        return redirect(
            new URL("/.well-known/nodeinfo/2.0", config.http.base_url),
            301,
        );
    }),
);
