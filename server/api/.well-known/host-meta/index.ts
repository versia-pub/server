import { MatchedRoute } from "bun";
import { getHost } from "@config";
import { xmlResponse } from "@response";

/**
 * Host meta endpoint
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	return xmlResponse(`
	<?xml version="1.0" encoding="UTF-8"?>
	<XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0">
	<Link rel="lrdd" template="https://${getHost()}/.well-known/webfinger?resource={uri}"/>
	</XRD>
	`);
};
