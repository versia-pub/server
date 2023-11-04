/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { applyConfig } from "@api";
import { getConfig } from "@config";
import { getBestContentType } from "@content_types";
import { errorResponse, jsonResponse } from "@response";
import { MatchedRoute } from "bun";
import { Emoji } from "~database/entities/Emoji";
import { LysandObject } from "~database/entities/Object";
import { Status } from "~database/entities/Status";
import { User, userRelations } from "~database/entities/User";
import {
	ContentFormat,
	LysandAction,
	LysandObjectType,
	LysandPublication,
	Patch,
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
			"spki",
			Buffer.from(author.public_key, "base64"),
			"Ed25519",
			false,
			["verify"]
		);

		// Check if signed string is valid
		const isValid = await crypto.subtle.verify(
			"Ed25519",
			publicKey,
			Buffer.from(signature, "base64"),
			new TextEncoder().encode(expectedSignedString)
		);

		if (!isValid) {
			return errorResponse("Invalid signature", 401);
		}
	}

	// Get the object's ActivityPub type
	const type = body.type;

	switch (type) {
		case "Note": {
			// Store the object in the LysandObject table
			await LysandObject.createFromObject(body);

			const content = getBestContentType(body.contents);

			const emojis = await Emoji.parseEmojis(content?.content || "");

			const newStatus = await Status.createNew({
				account: author,
				content: content?.content || "",
				content_type: content?.content_type,
				application: null,
				// TODO: Add visibility
				visibility: "public",
				spoiler_text: body.subject || "",
				sensitive: body.is_sensitive,
				uri: body.uri,
				emojis: emojis,
				mentions: await User.parseMentions(body.mentions),
			});

			// If there is a reply, fetch all the reply parents and add them to the database
			if (body.replies_to.length > 0) {
				newStatus.in_reply_to_post = await Status.fetchFromRemote(
					body.replies_to[0]
				);
			}

			// Same for quotes
			if (body.quotes.length > 0) {
				newStatus.quoting_post = await Status.fetchFromRemote(
					body.quotes[0]
				);
			}

			await newStatus.save();
			break;
		}
		case "Patch": {
			const patch = body as Patch;
			// Store the object in the LysandObject table
			await LysandObject.createFromObject(patch);

			// Edit the status

			const content = getBestContentType(patch.contents);

			const emojis = await Emoji.parseEmojis(content?.content || "");

			const status = await Status.findOneBy({
				id: patch.patched_id,
			});

			if (!status) {
				return errorResponse("Status not found", 404);
			}

			status.content = content?.content || "";
			status.content_type = content?.content_type || "text/plain";
			status.spoiler_text = patch.subject || "";
			status.sensitive = patch.is_sensitive;
			status.emojis = emojis;

			// If there is a reply, fetch all the reply parents and add them to the database
			if (body.replies_to.length > 0) {
				status.in_reply_to_post = await Status.fetchFromRemote(
					body.replies_to[0]
				);
			}

			// Same for quotes
			if (body.quotes.length > 0) {
				status.quoting_post = await Status.fetchFromRemote(
					body.quotes[0]
				);
			}
			break;
		}
		case "Like": {
			// Store the object in the LysandObject table
			await LysandObject.createFromObject(body);
			break;
		}
		case "Dislike": {
			// Store the object in the LysandObject table
			await LysandObject.createFromObject(body);
			break;
		}
		case "Follow": {
			// Store the object in the LysandObject table
			await LysandObject.createFromObject(body);
			break;
		}
		case "FollowAccept": {
			// Store the object in the LysandObject table
			await LysandObject.createFromObject(body);
			break;
		}
		case "FollowReject": {
			// Store the object in the LysandObject table
			await LysandObject.createFromObject(body);
			break;
		}
		case "Announce": {
			// Store the object in the LysandObject table
			await LysandObject.createFromObject(body);
			break;
		}
		case "Undo": {
			// Store the object in the LysandObject table
			await LysandObject.createFromObject(body);
			break;
		}
		case "Extension": {
			// Store the object in the LysandObject table
			await LysandObject.createFromObject(body);
			break;
		}
		default: {
			return errorResponse("Invalid type", 400);
		}
	}

	return jsonResponse({});
};
