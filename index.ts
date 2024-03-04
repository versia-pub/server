import { getConfig } from "~classes/configmanager";
import { jsonResponse } from "@response";
import chalk from "chalk";
import { appendFile } from "fs/promises";
import { matches } from "ip-matching";
import { getFromRequest } from "~database/entities/User";
import { mkdir } from "fs/promises";
import type { PrismaClientInitializationError } from "@prisma/client/runtime/library";
import { initializeRedisCache } from "@redis";
import { connectMeili } from "@meilisearch";
import { matchRoute } from "~routes";

const timeAtStart = performance.now();

console.log(`${chalk.green(`>`)} ${chalk.bold("Starting Lysand...")}`);

const config = getConfig();
const requests_log = Bun.file(process.cwd() + "/logs/requests.log");

// Needs to be imported after config is loaded
import { client } from "~database/datasource";

// NODE_ENV seems to be broken and output `development` even when set to production, so use the flag instead
const isProd =
	process.env.NODE_ENV === "production" || process.argv.includes("--prod");

if (!(await requests_log.exists())) {
	console.log(`${chalk.green(`✓`)} ${chalk.bold("Creating logs folder...")}`);
	await mkdir(process.cwd() + "/logs");
	await Bun.write(process.cwd() + "/logs/requests.log", "");
}

const redisCache = await initializeRedisCache();

if (config.meilisearch.enabled) {
	await connectMeili();
}

if (redisCache) {
	client.$use(redisCache);
}

// Check if database is reachable
let postCount = 0;
try {
	postCount = await client.status.count();
} catch (e) {
	const error = e as PrismaClientInitializationError;
	console.error(
		`${chalk.red(`✗`)} ${chalk.bold(
			"Error while connecting to database: "
		)} ${error.message}`
	);
	process.exit(1);
}

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
				(meta.auth.requiredOnMethods ?? []).includes(req.method as any)
			) {
				if (!auth.user) {
					return new Response(undefined, {
						status: 401,
						statusText: "Unauthorized",
					});
				}
			}

			return await (await file).default(req.clone(), matchedRoute, auth);
		} else {
			// Proxy response from Vite at localhost:5173 if in development mode
			if (isProd) {
				if (new URL(req.url).pathname.startsWith("/assets")) {
					// Serve from pages/dist/assets
					return new Response(
						// @ts-expect-error Custom Bun extension
						Bun.file(`./pages/dist${new URL(req.url).pathname}`)
					);
				}

				// Serve from pages/dist
				return new Response(
					// @ts-expect-error Custom Bun extension
					Bun.file(`./pages/dist/index.html`)
				);
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

// Remove previous console.log
// console.clear();

console.log(
	`${chalk.green(`✓`)} ${chalk.bold(
		`Lysand started at ${chalk.blue(
			`${config.http.bind}:${config.http.bind_port}`
		)} in ${chalk.gray((performance.now() - timeAtStart).toFixed(0))}ms`
	)}`
);

console.log(
	`${chalk.green(`✓`)} ${chalk.bold(`Database is ${chalk.blue("online")}`)}`
);

// Print "serving x posts"
console.log(
	`${chalk.green(`✓`)} ${chalk.bold(
		`Serving ${chalk.blue(postCount)} posts`
	)}`
);
