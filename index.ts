import { getConfig } from "@config";
import { jsonResponse } from "@response";
import { MatchedRoute } from "bun";
import { appendFile } from "fs/promises";
import { matches } from "ip-matching";
import "reflect-metadata";
import { AppDataSource } from "~database/datasource";
import { User } from "~database/entities/User";
import { APIRouteMeta } from "~types/api";

const router = new Bun.FileSystemRouter({
	style: "nextjs",
	dir: process.cwd() + "/server/api",
});

console.log("[+] Starting Lysand...");

const config = getConfig();
const requests_log = Bun.file(process.cwd() + "/logs/requests.log");

if (!(await requests_log.exists())) {
	console.log("[+] requests.log does not exist, creating it...");
	await Bun.write(process.cwd() + "/logs/requests.log", "");
}

if (!AppDataSource.isInitialized) await AppDataSource.initialize();

Bun.serve({
	port: config.http.bind_port,
	hostname: config.http.bind || "0.0.0.0", // defaults to "0.0.0.0"
	async fetch(req) {
		/* Check for banned IPs */
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

		await logRequest(req);

		if (req.method === "OPTIONS") {
			return jsonResponse({});
		}

		const matchedRoute = router.match(req);

		if (matchedRoute) {
			const file: {
				meta: APIRouteMeta;
				default: (
					req: Request,
					matchedRoute: MatchedRoute
				) => Response | Promise<Response>;
			} = await import(matchedRoute.filePath);

			const meta = file.meta;

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

			// Check for authentication if required
			if (meta.auth.required) {
				const { user } = await User.getFromRequest(req);

				if (!user) {
					return new Response(undefined, {
						status: 401,
						statusText: "Unauthorized",
					});
				}
			} else if (
				(meta.auth.requiredOnMethods ?? []).includes(req.method as any)
			) {
				const { user } = await User.getFromRequest(req);

				if (!user) {
					return new Response(undefined, {
						status: 401,
						statusText: "Unauthorized",
					});
				}
			}

			return file.default(req, matchedRoute);
		} else {
			return new Response(undefined, {
				status: 404,
				statusText: "Route not found",
			});
		}
	},
});

const logRequest = async (req: Request) => {
	if (config.logging.log_requests_verbose) {
		await appendFile(
			`${process.cwd()}/logs/requests.log`,
			`[${new Date().toISOString()}] ${req.method} ${
				req.url
			}\n\tHeaders:\n`
		);

		// Add headers

		const headers = req.headers.entries();

		for (const [key, value] of headers) {
			await appendFile(
				`${process.cwd()}/logs/requests.log`,
				`\t\t${key}: ${value}\n`
			);
		}

		const body = await req.clone().text();

		await appendFile(
			`${process.cwd()}/logs/requests.log`,
			`\tBody:\n\t${body}\n`
		);
	} else if (config.logging.log_requests) {
		await appendFile(
			process.cwd() + "/logs/requests.log",
			`[${new Date().toISOString()}] ${req.method} ${req.url}\n`
		);
	}
};

console.log("[+] Lysand started!");
