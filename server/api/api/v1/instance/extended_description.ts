import { applyConfig, auth } from "@/api";
import { dualLogger } from "@/loggers";
import { jsonResponse } from "@/response";
import type { Hono } from "hono";
import { getMarkdownRenderer } from "~/database/entities/Status";
import { config } from "~/packages/config-manager";
import { LogLevel } from "~/packages/log-manager";

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

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        auth(meta.auth, meta.permissions),
        async () => {
            let extended_description = (await getMarkdownRenderer()).render(
                "This is a [Lysand](https://lysand.org) server with the default extended description.",
            );
            let lastModified = new Date(2024, 0, 0);

            const extended_description_file = Bun.file(
                config.instance.extended_description_path || "",
            );

            if (await extended_description_file.exists()) {
                extended_description =
                    (await getMarkdownRenderer()).render(
                        (await extended_description_file
                            .text()
                            .catch(async (e) => {
                                await dualLogger.logError(
                                    LogLevel.ERROR,
                                    "Routes",
                                    e,
                                );
                                return "";
                            })) ||
                            "This is a [Lysand](https://lysand.org) server with the default extended description.",
                    ) || "";
                lastModified = new Date(extended_description_file.lastModified);
            }

            return jsonResponse({
                updated_at: lastModified.toISOString(),
                content: extended_description,
            });
        },
    );
