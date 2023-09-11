const router = new Bun.FileSystemRouter({
	style: "nextjs",
	dir: process.cwd() + "/server/api",
})

console.log("[+] Starting FediProject...");

Bun.serve({
	port: 8653,
	hostname: "0.0.0.0", // defaults to "0.0.0.0"
	async fetch(req) {
		const matchedRoute = router.match(req);

		if (matchedRoute) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
			return (await import(matchedRoute.filePath)).default(req, matchedRoute) as Response | Promise<Response>;
		} else {
			return new Response(undefined, {
				status: 404,
				statusText: "Route not found",
			});
		}
	},
});

console.log("[+] FediProject started!")
