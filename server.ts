import { errorResponse, response } from "@response";
import type { Config } from "config-manager";
import { matches } from "ip-matching";
import type { LogManager, MultiLogManager } from "log-manager";
import { LogLevel } from "log-manager";
import { processRoute } from "server-handler";
import { matchRoute } from "~routes";

export const createServer = (
    config: Config,
    logger: LogManager | MultiLogManager,
    isProd: boolean,
) =>
    Bun.serve({
        port: config.http.bind_port,
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

            // If route is .well-known, remove dot because the filesystem router can't handle dots for some reason
            const matchedRoute = matchRoute(
                req.url.replace(".well-known", "well-known"),
            );
            if (matchedRoute?.filePath && matchedRoute.name !== "/[...404]") {
                return await processRoute(matchedRoute, req, logger);
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
                return errorResponse("Route not found", 404);
            });

            if (
                proxy.status !== 404 &&
                !(await proxy.clone().text()).includes("404 Not Found")
            ) {
                return proxy;
            }

            return errorResponse("Route not found", 404);
        },
    });
