import { jsonResponse } from "@response";
import { matches } from "ip-matching";
import { getFromRequest } from "~database/entities/User";
import type { ConfigManager, ConfigType } from "config-manager";
import type { LogManager, MultiLogManager } from "log-manager";
import { LogLevel } from "log-manager";
import { RequestParser } from "request-parser";

export const createServer = (
	config: ConfigType,
	configManager: ConfigManager,
	logger: LogManager | MultiLogManager,
	isProd: boolean
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
						return new Response(undefined, {
							status: 403,
							statusText: "Forbidden",
						});
					}
				} catch (e) {
					console.error(`[-] Error while parsing banned IP "${ip}" `);
					throw e;
				}
			}

			// Check for banned user agents (regex)
			const ua = req.headers.get("User-Agent") ?? "";

			for (const agent of config.http.banned_user_agents) {
				if (new RegExp(agent).test(ua)) {
					return new Response(undefined, {
						status: 403,
						statusText: "Forbidden",
					});
				}
			}

			if (config.logging.log_requests) {
				await logger.logRequest(
					req,
					config.logging.log_ip ? request_ip : undefined,
					config.logging.log_requests_verbose
				);
			}

			if (req.method === "OPTIONS") {
				return jsonResponse({});
			}

			// If it isn't dynamically imported, it causes trouble with imports
			// There shouldn't be a performance hit after bundling right?
			const { matchRoute } = await import("~routes");

			const { file, matchedRoute } = matchRoute(req.url);

			if (matchedRoute) {
				const meta = (await file).meta;

				// Check for allowed requests
				if (!meta.allowedMethods.includes(req.method as any)) {
					return new Response(undefined, {
						status: 405,
						statusText: `Method not allowed: allowed methods are: ${meta.allowedMethods.join(
							", "
						)}`,
					});
				}

				// TODO: Check for ratelimits
				const auth = await getFromRequest(req);

				// Check for authentication if required
				if (meta.auth.required) {
					if (!auth.user) {
						return new Response(undefined, {
							status: 401,
							statusText: "Unauthorized",
						});
					}
				} else if (
					(meta.auth.requiredOnMethods ?? []).includes(
						req.method as any
					)
				) {
					if (!auth.user) {
						return new Response(undefined, {
							status: 401,
							statusText: "Unauthorized",
						});
					}
				}

				let parsedRequest = {};

				try {
					parsedRequest = await new RequestParser(req).toObject();
				} catch (e) {
					await logger.logError(
						LogLevel.ERROR,
						"Server.RouteRequestParser",
						e as Error
					);
					return new Response(undefined, {
						status: 400,
						statusText: "Bad request",
					});
				}

				return await (
					await file
				).default(req.clone(), matchedRoute, {
					auth,
					configManager,
					parsedRequest,
				});
			} else {
				// Proxy response from Vite at localhost:5173 if in development mode
				if (isProd) {
					if (new URL(req.url).pathname.startsWith("/assets")) {
						// Serve from pages/dist/assets
						return new Response(
							Bun.file(`./pages/dist${new URL(req.url).pathname}`)
						);
					}

					// Serve from pages/dist
					return new Response(Bun.file(`./pages/dist/index.html`));
				} else {
					const proxy = await fetch(
						req.url.replace(
							config.http.base_url,
							"http://localhost:5173"
						)
					);

					if (proxy.status !== 404) {
						return proxy;
					}
				}

				return new Response(undefined, {
					status: 404,
					statusText: "Route not found",
				});
			}
		},
	});
