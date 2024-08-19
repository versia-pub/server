import { apiRoute, applyConfig, auth } from "@/api";
import { renderMarkdownInPath } from "@/markdown";
import { config } from "~/packages/config-manager";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    route: "/api/v1/instance/extended_description",
    ratelimits: {
        max: 300,
        duration: 60,
    },
    auth: {
        required: false,
    },
});

export default apiRoute((app) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { content, lastModified } = await renderMarkdownInPath(
                config.instance.extended_description_path ?? "",
                "This is a [Versia](https://versia.pub) server with the default extended description.",
            );

            return context.json({
                updated_at: lastModified.toISOString(),
                content,
            });
        },
    ),
);
