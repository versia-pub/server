import { getConfig } from "@config";
import { jsonResponse } from "@response";
import { MatchedRoute } from "bun";
import chalk from "chalk";
import { appendFile } from "fs/promises";
import { matches } from "ip-matching";
import "reflect-metadata";
import { AuthData, getFromRequest } from "~database/entities/User";
import { APIRouteMeta } from "~types/api";
import { mkdir } from "fs/promises";
import { client } from "~database/datasource";
import { PrismaClientInitializationError } from "@prisma/client/runtime/library";

const router = new Bun.FileSystemRouter({
	style: "nextjs",
	dir: process.cwd() + "/server/api",
});

console.log(`${chalk.green(`>`)} ${chalk.bold("Starting Lysand...")}`);

const config = getConfig();
const requests_log = Bun.file(process.cwd() + "/logs/requests.log");

if (!(await requests_log.exists())) {
	console.log(`${chalk.green(`✓`)} ${chalk.bold("Creating logs folder...")}`);
	await mkdir(process.cwd() + "/logs");
	await Bun.write(process.cwd() + "/logs/requests.log", "");
}

// Check if database is reachable
const postCount = 0;
try {
	await client.status.count();
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

		const matchedRoute = router.match(req);

		if (matchedRoute) {
			const file: {
				meta: APIRouteMeta;
				default: (
					req: Request,
					matchedRoute: MatchedRoute,
					auth: AuthData
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

			return file.default(req, matchedRoute, auth);
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

// Remove previous console.log
console.clear();

console.log(
	`${chalk.green(`✓`)} ${chalk.bold(
		`Lysand started at ${chalk.blue(
			`${config.http.bind}:${config.http.bind_port}`
		)}`
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
