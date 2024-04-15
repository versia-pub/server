import { dualLogger } from "@loggers";
import { errorResponse } from "@response";
import { config } from "config-manager";
import { join } from "node:path";
import {
    LogLevel,
    type LogManager,
    type MultiLogManager,
} from "~packages/log-manager";

export const handleGlitchRequest = async (
    req: Request,
    logger: LogManager | MultiLogManager,
): Promise<Response> => {
    const url = new URL(req.url);
    let path = url.pathname;

    // Strip leading /web from path
    if (path.startsWith("/web")) path = path.slice(4);

    // Redirect / to /index.html
    if (path === "/" || path === "") path = "/index.html";
    // If path doesn't have an extension (e.g. /about), serve index.html
    // Also check if Accept header contains text/html
    if (!path.includes(".") && req.headers.get("Accept")?.includes("text/html"))
        path = "/index.html";

    const file = Bun.file(join(config.frontend.glitch.assets, path));

    if (await file.exists()) {
        return new Response(file);
    }

    dualLogger.log(LogLevel.WARNING, "Glitch-Soc", `Asset not found: ${path}`);

    return errorResponse("Glitch-Soc route not found", 404);
};
