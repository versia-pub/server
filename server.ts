import { dualLogger } from "@loggers";
import { clientResponse, errorResponse, response } from "@response";
import type { MatchedRoute } from "bun";
import type { Config } from "config-manager";
import { matches } from "ip-matching";
import type { LogManager, MultiLogManager } from "log-manager";
import { LogLevel } from "log-manager";
import { processRoute } from "server-handler";
import { handleGlitchRequest } from "~packages/glitch-server/main";
import { matchRoute } from "~routes";

export const createServer = (
    config: Config,
    logger: LogManager | MultiLogManager,
    isProd: boolean,
) =>
    Bun.serve({
        port: config.http.bind_port,
        tls: config.http.tls.enabled
            ? {
                  key: Bun.file(config.http.tls.key),
                  cert: Bun.file(config.http.tls.cert),
                  passphrase: config.http.tls.passphrase,
                  ca: config.http.tls.ca
                      ? Bun.file(config.http.tls.ca)
                      : undefined,
              }
            : undefined,
        hostname: config.http.bind || "0.0.0.0", // defaults to "0.0.0.0"
        async fetch(req) {
            // Check for banned IPs
            const request_ip = this.requestIP(req)?.address ?? "";

            for (const ip of config.http.banned_ips) {
                try {
                    if (matches(ip, request_ip)) {
                        return errorResponse("Forbidden", 403);
                    }
                } catch (e) {
                    logger.log(
                        LogLevel.ERROR,
                        "Server.IPCheck",
                        `Error while parsing banned IP "${ip}" `,
                    );
                    logger.logError(
                        LogLevel.ERROR,
                        "Server.IPCheck",
                        e as Error,
                    );

                    return errorResponse(
                        `A server error occured: ${(e as Error).message}`,
                        500,
                    );
                }
            }

            // Check for banned user agents (regex)
            const ua = req.headers.get("User-Agent") ?? "";

            for (const agent of config.http.banned_user_agents) {
                if (new RegExp(agent).test(ua)) {
                    return errorResponse("Forbidden", 403);
                }
            }

            if (config.http.bait.enabled) {
                // Check for bait IPs
                for (const ip of config.http.bait.bait_ips) {
                    try {
                        if (matches(ip, request_ip)) {
                            const file = Bun.file(
                                config.http.bait.send_file || "./beemovie.txt",
                            );

                            if (await file.exists()) {
                                return response(file);
                            }
                            await logger.log(
                                LogLevel.ERROR,
                                "Server.Bait",
                                `Bait file not found: ${config.http.bait.send_file}`,
                            );
                        }
                    } catch (e) {
                        logger.log(
                            LogLevel.ERROR,
                            "Server.IPCheck",
                            `Error while parsing bait IP "${ip}" `,
                        );
                        logger.logError(
                            LogLevel.ERROR,
                            "Server.IPCheck",
                            e as Error,
                        );

                        return errorResponse(
                            `A server error occured: ${(e as Error).message}`,
                            500,
                        );
                    }
                }

                // Check for bait user agents (regex)
                for (const agent of config.http.bait.bait_user_agents) {
                    if (new RegExp(agent).test(ua)) {
                        const file = Bun.file(
                            config.http.bait.send_file || "./beemovie.txt",
                        );

                        if (await file.exists()) {
                            return response(file);
                        }
                        await logger.log(
                            LogLevel.ERROR,
                            "Server.Bait",
                            `Bait file not found: ${config.http.bait.send_file}`,
                        );
                    }
                }
            }

            if (config.logging.log_requests) {
                await logger.logRequest(
                    req.clone(),
                    config.logging.log_ip ? request_ip : undefined,
                    config.logging.log_requests_verbose,
                );
            }

            const routePaths = [
                "/api",
                "/media",
                "/nodeinfo",
                "/.well-known",
                "/users",
                "/objects",
                "/oauth/token",
                "/oauth/providers",
            ];

            // Check if URL starts with routePath
            if (
                routePaths.some((path) =>
                    new URL(req.url).pathname.startsWith(path),
                ) ||
                (new URL(req.url).pathname.startsWith("/oauth/authorize") &&
                    req.method === "POST")
            ) {
                // If route is .well-known, remove dot because the filesystem router can't handle dots for some reason
                const matchedRoute = matchRoute(
                    new Request(req.url.replace(".well-known", "well-known"), {
                        method: req.method,
                    }),
                );

                if (
                    matchedRoute?.filePath &&
                    matchedRoute.name !== "/[...404]" &&
                    !(
                        new URL(req.url).pathname.startsWith(
                            "/oauth/authorize",
                        ) && req.method === "GET"
                    )
                ) {
                    return await processRoute(matchedRoute, req, logger);
                }
            }

            if (config.frontend.glitch.enabled) {
                if (!new URL(req.url).pathname.startsWith("/oauth")) {
                    const glitch = await handleGlitchRequest(req, dualLogger);

                    if (glitch) {
                        return glitch;
                    }
                }
            }

            const base_url_with_http = config.http.base_url.replace(
                "https://",
                "http://",
            );

            const replacedUrl = req.url
                .replace(config.http.base_url, config.frontend.url)
                .replace(base_url_with_http, config.frontend.url);

            const proxy = await fetch(replacedUrl, {
                headers: {
                    // Include for SSR
                    "X-Forwarded-Host": `${config.http.bind}:${config.http.bind_port}`,
                    "Accept-Encoding": "identity",
                },
            }).catch(async (e) => {
                await logger.logError(
                    LogLevel.ERROR,
                    "Server.Proxy",
                    e as Error,
                );
                await logger.log(
                    LogLevel.ERROR,
                    "Server.Proxy",
                    `The Frontend is not running or the route is not found: ${replacedUrl}`,
                );
                return null;
            });

            proxy?.headers.set("Cache-Control", "max-age=31536000");

            if (!proxy || proxy.status === 404) {
                return errorResponse(
                    "Route not found on proxy or API route",
                    404,
                );
            }

            return clientResponse(
                await proxy.arrayBuffer(),
                proxy.status,
                proxy.headers.toJSON(),
            );
        },
    });
