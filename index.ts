import { getConfig } from "@config";
import { appendFile } from "fs/promises";
import "reflect-metadata";
import { AppDataSource } from "~database/datasource";

const router = new Bun.FileSystemRouter({
	style: "nextjs",
	dir: process.cwd() + "/server/api",
});

console.log("[+] Starting FediProject...");

const config = getConfig();
const requests_log = Bun.file(process.cwd() + "/logs/requests.log");

if (!(await requests_log.exists())) {
	console.log("[+] requests.log does not exist, creating it...");
	await Bun.write(process.cwd() + "/logs/requests.log", "");
}

if (!AppDataSource.isInitialized) await AppDataSource.initialize();

Bun.serve({
	port: config.http.port,
	hostname: config.http.base_url || "0.0.0.0", // defaults to "0.0.0.0"
	async fetch(req) {
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

		const matchedRoute = router.match(req);

		if (matchedRoute) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
			return (await import(matchedRoute.filePath)).default(
				req,
				matchedRoute
			) as Response | Promise<Response>;
		} else {
			return new Response(undefined, {
				status: 404,
				statusText: "Route not found",
			});
		}
	},
});

console.log("[+] FediProject started!");
