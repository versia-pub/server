import { apiRoute, applyConfig } from "@api";
import { errorResponse } from "@response";

export const meta = applyConfig({
	allowedMethods: ["POST", "GET", "PUT", "PATCH", "DELETE"],
	auth: {
		required: false,
	},
	ratelimits: {
		duration: 60,
		max: 100,
	},
	route: "/[...404]",
});

/**
 * Default catch-all route, returns a 404 error.
 */
export default apiRoute(() => {
	return errorResponse("This API route does not exist", 404);
});
