import { errorResponse, response } from "@/response";
import { Hono } from "@hono/hono";
import { getLogger } from "@logtape/logtape";
import { config } from "config-manager";
import { agentBans } from "./middlewares/agent-bans";
import { bait } from "./middlewares/bait";
import { boundaryCheck } from "./middlewares/boundary-check";
import { ipBans } from "./middlewares/ip-bans";
import { logger } from "./middlewares/logger";
import { handleGlitchRequest } from "./packages/glitch-server/main";
import { routes } from "./routes";
import type { ApiRouteExports } from "./types/api";

export const appFactory = async () => {
    const serverLogger = getLogger("server");

    const app = new Hono({
        strict: false,
    });

    app.use(ipBans);
    app.use(agentBans);
    app.use(bait);
    app.use(logger);
    app.use(boundaryCheck);
    // Disabled as federation now checks for this
    // app.use(urlCheck);

    // Inject own filesystem router
    for (const [, path] of Object.entries(routes)) {
        // use app.get(path, handler) to add routes
        const route: ApiRouteExports = await import(path);

        if (!(route.meta && route.default)) {
            throw new Error(`Route ${path} does not have the correct exports.`);
        }

        route.default(app);
    }

    app.options("*", () => {
        return response(null);
    });

    app.all("*", async (context) => {
        if (config.frontend.glitch.enabled) {
            const glitch = await handleGlitchRequest(context.req.raw);

            if (glitch) {
                return glitch;
            }
        }

        const replacedUrl = new URL(
            new URL(context.req.url).pathname,
            config.frontend.url,
        ).toString();

        serverLogger.debug`Proxying ${replacedUrl}`;

        const proxy = await fetch(replacedUrl, {
            headers: {
                // Include for SSR
                "X-Forwarded-Host": `${config.http.bind}:${config.http.bind_port}`,
                "Accept-Encoding": "identity",
            },
            redirect: "manual",
        }).catch((e) => {
            serverLogger.error`${e}`;
            serverLogger.error`The Frontend is not running or the route is not found: ${replacedUrl}`;
            return null;
        });

        proxy?.headers.set("Cache-Control", "max-age=31536000");

        if (!proxy || proxy.status === 404) {
            return errorResponse(
                "Route not found on proxy or API route. Are you using the correct HTTP method?",
                404,
            );
        }

        // Disable CSP upgrade-insecure-requests if an .onion domain is used
        if (new URL(context.req.url).hostname.endsWith(".onion")) {
            proxy.headers.set(
                "Content-Security-Policy",
                proxy.headers
                    .get("Content-Security-Policy")
                    ?.replace("upgrade-insecure-requests;", "") ?? "",
            );
        }

        return proxy;
    });

    return app;
};

export type App = Awaited<ReturnType<typeof appFactory>>;
