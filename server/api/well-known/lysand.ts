import { apiRoute, applyConfig } from "@api";
import { urlToContentFormat } from "@content_types";
import { jsonResponse } from "@response";
import type * as Lysand from "lysand-types";
import pkg from "../../../package.json";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    auth: {
        required: false,
    },
    ratelimits: {
        duration: 60,
        max: 60,
    },
    route: "/.well-known/lysand",
});

export default apiRoute(async (req, matchedRoute, extraData) => {
    const config = await extraData.configManager.getConfig();

    // In the format acct:name@example.com
    return jsonResponse({
        type: "ServerMetadata",
        name: config.instance.name,
        version: pkg.version,
        description: config.instance.description,
        logo: urlToContentFormat(config.instance.logo) ?? undefined,
        banner: urlToContentFormat(config.instance.banner) ?? undefined,
        supported_extensions: ["org.lysand:custom_emojis"],
        website: "https://lysand.org",
        // TODO: Add admins, moderators field
    } satisfies Lysand.ServerMetadata);
});
