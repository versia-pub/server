import { getConfig } from "@config";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { AppDataSource } from "~database/datasource";
import { RawActivity } from "~database/entities/RawActivity";
import { Token } from "~database/entities/Token";
import { User } from "~database/entities/User";

const config = getConfig();

beforeAll(async () => {
	if (!AppDataSource.isInitialized) await AppDataSource.initialize();

	// Initialize test user
	const user = new User();

	user.email = "test@test.com";
	user.username = "test";
	user.password = await Bun.password.hash("test");
	user.display_name = "";
	user.bio = "";

	await user.save();
});

describe("POST /@test/inbox", () => {
	test("should store a new Note object", async () => {
		const response = await fetch(
			`${config.http.base_url}:${config.http.port}/@test/inbox/`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/activity+json",
				},
				body: JSON.stringify({
					"@context": "https://www.w3.org/ns/activitystreams",
					type: "Create",
					id: "https://example.com/notes/1/activity",
					actor: `${config.http.base_url}:${config.http.port}/@test`,
					to: ["https://www.w3.org/ns/activitystreams#Public"],
					cc: [],
					published: "2021-01-01T00:00:00.000Z",
					object: {
						"@context": "https://www.w3.org/ns/activitystreams",
						id: "https://example.com/notes/1",
						type: "Note",
						content: "Hello, world!",
						summary: null,
						inReplyTo: null,
						published: "2021-01-01T00:00:00.000Z",
					},
				}),
			}
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("application/json");

		const activity = await RawActivity.createQueryBuilder("activity")
			// id is part of the jsonb column 'data'
			.where("activity.data->>'id' = :id", {
				id: "https://example.com/notes/1/activity",
			})
			.leftJoinAndSelect("activity.objects", "objects")
			.getOne();

		expect(activity).not.toBeUndefined();
		expect(activity?.data).toEqual({
			"@context": "https://www.w3.org/ns/activitystreams",
			type: "Create",
			id: "https://example.com/notes/1/activity",
			actor: `${config.http.base_url}:${config.http.port}/@test`,
			to: ["https://www.w3.org/ns/activitystreams#Public"],
			cc: [],
			published: "2021-01-01T00:00:00.000Z",
		});

		expect(activity?.objects).toHaveLength(1);
		expect(activity?.objects[0].data).toEqual({
			"@context": "https://www.w3.org/ns/activitystreams",
			id: "https://example.com/notes/1",
			type: "Note",
			content: "Hello, world!",
			summary: null,
			inReplyTo: null,
			published: "2021-01-01T00:00:00.000Z",
		});
	});
});

afterAll(async () => {
	// Clean up user
	const user = await User.findOneBy({
		username: "test",
	});

	// Clean up tokens
	const tokens = await Token.findBy({
		user: {
			username: "test",
		},
	});

	const activities = await RawActivity.createQueryBuilder("activity")
		.where("activity.data->>'actor' = :actor", {
			actor: `${config.http.base_url}:${config.http.port}/@test`,
		})
		.leftJoinAndSelect("activity.objects", "objects")
		.getMany();

	// Delete all created objects and activities as part of testing
	await Promise.all(
		activities.map(async activity => {
			await Promise.all(
				activity.objects.map(async object => await object.remove())
			);
			await activity.remove();
		})
	);

	await Promise.all(tokens.map(async token => await token.remove()));

	if (user) await user.remove();
});
