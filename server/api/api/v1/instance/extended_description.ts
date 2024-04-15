import { apiRoute, applyConfig } from "@api";
import { dualLogger } from "@loggers";
import { jsonResponse } from "@response";
import { parse } from "marked";
import { LogLevel } from "~packages/log-manager";

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

export default apiRoute(async (req, matchedRoute, extraData) => {
    const config = await extraData.configManager.getConfig();

    let extended_description = parse(
        "This is a [Lysand](https://lysand.org) server with the default extended description.",
    );
    let lastModified = new Date(2024, 0, 0);

    const extended_description_file = Bun.file(
        config.instance.extended_description_path,
    );

    if (await extended_description_file.exists()) {
        extended_description =
            (await parse(
                (await extended_description_file.text().catch(async (e) => {
                    await dualLogger.logError(LogLevel.ERROR, "Routes", e);
                    return "";
                })) ||
                    "This is a [Lysand](https://lysand.org) server with the default extended description.",
            )) || "";
        lastModified = new Date(extended_description_file.lastModified);
    }

    return jsonResponse({
        updated_at: lastModified.toISOString(),
        content: extended_description,
    });
});
