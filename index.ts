const router = new Bun.FileSystemRouter({
	style: "nextjs",
	dir: process.cwd() + "/server/api",
})

Bun.serve({
	port: 8080,
	hostname: "0.0.0.0", // defaults to "0.0.0.0"
	async fetch(req) {
		const url = new URL(req.url);

		const matchedRoute = router.match(req);

		if (matchedRoute) {
			return (await import(matchedRoute.filePath)).default(req, matchedRoute);
		} else {
			const response = new Response(undefined, {
				status: 404,
				statusText: "Route not found",
			});
		}
	},
});
