import { jsonResponse } from "@response";

/**
 * ActivityPub nodeinfo 2.0 endpoint
 */
// eslint-disable-next-line @typescript-eslint/require-await
export default async (): Promise<Response> => {
	// TODO: Implement this
	return jsonResponse({
		version: "2.0",
		software: { name: "fediproject", version: "0.0.1" },
		protocols: ["activitypub"],
		services: { outbound: [], inbound: [] },
		usage: {
			users: { total: 0, activeMonth: 0, activeHalfyear: 0 },
			localPosts: 0,
		},
		openRegistrations: false,
		metadata: {},
	});
};
