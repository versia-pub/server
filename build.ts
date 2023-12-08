await Bun.build({
	entrypoints: ["./index.ts"],
	outdir: "./dist",
	target: "bun",
	splitting: true,
	minify: false,
	external: ["bullmq", "@prisma/client"],
});
