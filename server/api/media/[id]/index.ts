import { errorResponse } from "@response";
import { applyConfig } from "@api";
import type { MatchedRoute } from "bun";

export const meta = applyConfig({
	allowedMethods: ["GET"],
	route: "/media/:id",
	ratelimits: {
		max: 100,
		duration: 60,
	},
	auth: {
		required: false,
	},
});

export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	// TODO: Add checks for disabled or not email verified accounts

	const id = matchedRoute.params.id;

	// Serve file from filesystem
	const file = Bun.file(`./uploads/${id}`);

	if (!(await file.exists())) return errorResponse("File not found", 404);

	// @ts-expect-error Bun allows this
	return new Response(file);
};
