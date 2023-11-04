/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { applyConfig } from "@api";
import { getConfig } from "@config";
import { errorResponse, jsonResponse } from "@response";
import { MatchedRoute } from "bun";
import { Status } from "~database/entities/Status";
import { User, userRelations } from "~database/entities/User";
import {
	ContentFormat,
	LysandAction,
	LysandObjectType,
	LysandPublication,
} from "~types/lysand/Object";

export const meta = applyConfig({
	allowedMethods: ["POST"],
	auth: {
		required: false,
	},
	ratelimits: {
		duration: 60,
		max: 500,
	},
	route: "/users/:username/inbox",
});

/**
 * ActivityPub user inbox endpoint
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	const username = matchedRoute.params.username;

	const config = getConfig();

	try {
		if (
			config.activitypub.reject_activities.includes(
				new URL(req.headers.get("Origin") ?? "").hostname
			)
		) {
			// Discard request
			return jsonResponse({});
		}
	} catch (e) {
		console.error(
			`[-] Error parsing Origin header of incoming Activity from ${req.headers.get(
				"Origin"
			)}`
		);
		console.error(e);
	}

	// Process request body
	const body = (await req.json()) as LysandPublication | LysandAction;

	const author = await User.findOne({
		where: {
			uri: body.author,
		},
		relations: userRelations,
	});

	if (!author) {
		// TODO: Add new author to database
		return errorResponse("Author not found", 404);
	}

	// Verify HTTP signature
	if (config.activitypub.authorized_fetch) {
		// Check if date is older than 30 seconds
		const origin = req.headers.get("Origin");

		if (!origin) {
			return errorResponse("Origin header is required", 401);
		}

		const date = req.headers.get("Date");

		if (!date) {
			return errorResponse("Date header is required", 401);
		}

		if (new Date(date).getTime() < Date.now() - 30000) {
			return errorResponse("Date is too old (max 30 seconds)", 401);
		}

		const signatureHeader = req.headers.get("Signature");

		if (!signatureHeader) {
			return errorResponse("Signature header is required", 401);
		}

		const signature = signatureHeader
			.split("signature=")[1]
			.replace(/"/g, "");

		const digest = await crypto.subtle.digest(
			"SHA-256",
			new TextEncoder().encode(await req.text())
		);

		const expectedSignedString =
			`(request-target): ${req.method.toLowerCase()} ${req.url}\n` +
			`host: ${req.url}\n` +
			`date: ${date}\n` +
			`digest: SHA-256=${Buffer.from(digest).toString("base64")}`;

		// author.public_key is base64 encoded raw public key
		const publicKey = await crypto.subtle.importKey(
			"raw",
			Buffer.from(author.public_key, "base64"),
			{
				name: "ed25519",
			},
			false,
			["verify"]
		);

		// Check if signed string is valid
		const isValid = await crypto.subtle.verify(
			{
				name: "ed25519",
				saltLength: 0,
			},
			publicKey,
			new TextEncoder().encode(signature),
			new TextEncoder().encode(expectedSignedString)
		);

		if (!isValid) {
			throw new Error("Invalid signature");
		}
	}

	// Get the object's ActivityPub type
	const type = body.type;

	switch (type) {
		case "Note": {
			let content: ContentFormat | null;

			// Find the best content and content type
			if (
				body.contents.find(
					c => c.content_type === "text/x.misskeymarkdown"
				)
			) {
				content =
					body.contents.find(
						c => c.content_type === "text/x.misskeymarkdown"
					) || null;
			} else if (
				body.contents.find(c => c.content_type === "text/html")
			) {
				content =
					body.contents.find(c => c.content_type === "text/html") ||
					null;
			} else if (
				body.contents.find(c => c.content_type === "text/markdown")
			) {
				content =
					body.contents.find(
						c => c.content_type === "text/markdown"
					) || null;
			} else if (
				body.contents.find(c => c.content_type === "text/plain")
			) {
				content =
					body.contents.find(c => c.content_type === "text/plain") ||
					null;
			} else {
				content = body.contents[0] || null;
			}

			const status = await Status.createNew({
				account: author,
				content: content?.content || "",
				content_type: content?.content_type,
				application: null,
				// TODO: Add visibility
				visibility: "public",
				spoiler_text: body.subject || "",
				sensitive: body.is_sensitive,
				// TODO: Add emojis
				emojis: [],
			});

			break;
		}
		case "Patch": {
			break;
		}
		case "Like": {
			break;
		}
		case "Dislike": {
			break;
		}
		case "Follow": {
			break;
		}
		case "FollowAccept": {
			break;
		}
		case "FollowReject": {
			break;
		}
		case "Announce": {
			break;
		}
		case "Undo": {
			break;
		}
		default: {
			return errorResponse("Invalid type", 400);
		}
	}

	return jsonResponse({});
};
