import { applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { client } from "~database/datasource";
import { getFromRequest } from "~database/entities/User";
import type { APIRouteMeta } from "~types/api";
import { uploadFile } from "~classes/media";
import { getConfig } from "@config";
import { attachmentToAPI, getUrl } from "~database/entities/Attachment";
import type { MatchedRoute } from "bun";
import { parseRequest } from "@request";

export const meta: APIRouteMeta = applyConfig({
	allowedMethods: ["GET", "PUT"],
	ratelimits: {
		max: 10,
		duration: 60,
	},
	route: "/api/v1/media/:id",
	auth: {
		required: true,
		oauthPermissions: ["write:media"],
	},
});

/**
 * Get media information
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	const { user } = await getFromRequest(req);

	if (!user) {
		return errorResponse("Unauthorized", 401);
	}

	const id = matchedRoute.params.id;

	const attachment = await client.attachment.findUnique({
		where: {
			id,
		},
	});

	if (!attachment) {
		return errorResponse("Media not found", 404);
	}

	const config = getConfig();

	switch (req.method) {
		case "GET": {
			if (attachment.url) {
				return jsonResponse(attachmentToAPI(attachment));
			} else {
				return new Response(null, {
					status: 206,
				});
			}
		}
		case "PUT": {
			const { description, thumbnail } = await parseRequest<{
				thumbnail?: File;
				description?: string;
				focus?: string;
			}>(req);

			let thumbnailUrl = attachment.thumbnail_url;

			if (thumbnail) {
				const hash = await uploadFile(
					thumbnail as unknown as File,
					config
				);

				thumbnailUrl = hash ? getUrl(hash, config) : "";
			}

			const descriptionText = description || attachment.description;

			if (
				descriptionText !== attachment.description ||
				thumbnailUrl !== attachment.thumbnail_url
			) {
				const newAttachment = await client.attachment.update({
					where: {
						id,
					},
					data: {
						description: descriptionText,
						thumbnail_url: thumbnailUrl,
					},
				});

				return jsonResponse(attachmentToAPI(newAttachment));
			}

			return jsonResponse(attachmentToAPI(attachment));
		}
	}

	return errorResponse("Method not allowed", 405);
};
