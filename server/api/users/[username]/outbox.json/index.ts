import { errorResponse, jsonLdResponse } from "@response";
import { MatchedRoute } from "bun";
import { User } from "~database/entities/User";
import { getHost } from "@config";
import { NodeObject, compact } from "jsonld";
import { RawActivity } from "~database/entities/RawActivity";

/**
 * ActivityPub user outbox endpoint
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	const username = matchedRoute.params.username.split("@")[0];
	const page = Boolean(matchedRoute.query.page || "false");
	const min_id = matchedRoute.query.min_id || false;
	const max_id = matchedRoute.query.max_id || false;

	const user = await User.findOneBy({ username });

	if (!user) {
		return errorResponse("User not found", 404);
	}

	// Get the user's corresponding ActivityPub notes
	const count = await RawActivity.count({
		where: {
			data: {
				attributedTo: `${getHost()}/@${user.username}`,
			},
		},
		order: {
			data: {
				published: "DESC",
			},
		},
	});

	const lastPost = (
		await RawActivity.find({
			where: {
				data: {
					attributedTo: `${getHost()}/@${user.username}`,
				},
			},
			order: {
				data: {
					published: "ASC",
				},
			},
			take: 1,
		})
	)[0];

	if (!page)
		return jsonLdResponse(
			await compact({
				"@context": [
					"https://www.w3.org/ns/activitystreams",
					"https://w3id.org/security/v1",
				],
				id: `${getHost()}/@${user.username}/inbox`,
				type: "OrderedCollection",
				totalItems: count,
				first: `${getHost()}/@${user.username}/outbox?page=true`,
				last: `${getHost()}/@${user.username}/outbox?min_id=${
					lastPost.id
				}&page=true`,
			})
		);
	else {
		let posts: RawActivity[] = [];

		if (min_id) {
			posts = await RawActivity.find({
				where: {
					data: {
						attributedTo: `${getHost()}/@${user.username}`,
						id: min_id,
					},
				},
				order: {
					data: {
						published: "DESC",
					},
				},
				take: 11, // Take one extra to have the ID of the next post
			});
		} else if (max_id) {
			posts = await RawActivity.find({
				where: {
					data: {
						attributedTo: `${getHost()}/@${user.username}`,
						id: max_id,
					},
				},
				order: {
					data: {
						published: "ASC",
					},
				},
				take: 10,
			});
		}

		return jsonLdResponse(
			await compact({
				"@context": [
					"https://www.w3.org/ns/activitystreams",
					{
						ostatus: "http://ostatus.org#",
						atomUri: "ostatus:atomUri",
						inReplyToAtomUri: "ostatus:inReplyToAtomUri",
						conversation: "ostatus:conversation",
						sensitive: "as:sensitive",
						toot: "http://joinmastodon.org/ns#",
						votersCount: "toot:votersCount",
						litepub: "http://litepub.social/ns#",
						directMessage: "litepub:directMessage",
						Emoji: "toot:Emoji",
						focalPoint: {
							"@container": "@list",
							"@id": "toot:focalPoint",
						},
						blurhash: "toot:blurhash",
					},
				],
				id: `${getHost()}/@${user.username}/inbox`,
				type: "OrderedCollectionPage",
				totalItems: count,
				partOf: `${getHost()}/@${user.username}/inbox`,
				// Next is less recent posts chronologically, uses min_id
				next: `${getHost()}/@${user.username}/outbox?min_id=${
					posts[posts.length - 1].id
				}&page=true`,
				// Prev is more recent posts chronologically, uses max_id
				prev: `${getHost()}/@${user.username}/outbox?max_id=${
					posts[0].id
				}&page=true`,
				orderedItems: posts
					.slice(0, 10)
					.map(post => post.data) as NodeObject[],
			})
		);
	}
};
