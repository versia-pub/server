import { getConfig } from "@config";
import { Worker } from "bullmq";
import { client, federationQueue } from "~database/datasource";
import {
	statusAndUserRelations,
	statusToLysand,
	type StatusWithRelations,
} from "./Status";
import type { User } from "@prisma/client";

const config = getConfig();

export const federationWorker = new Worker(
	"federation",
	async job => {
		await job.updateProgress(0);

		switch (job.name) {
			case "federation": {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
				const statusId = job.data.id as string;

				const status = await client.status.findUnique({
					where: { id: statusId },
					include: statusAndUserRelations,
				});

				if (!status) return;

				// Only get remote users that follow the author of the status, and the remote mentioned users
				const peopleToSendTo = await client.user.findMany({
					where: {
						OR: [
							["public", "unlisted", "private"].includes(
								status.visibility
							)
								? {
										relationships: {
											some: {
												subjectId: status.authorId,
												following: true,
											},
										},
										instanceId: {
											not: null,
										},
								  }
								: {},
							// Mentioned users
							{
								id: {
									in: status.mentions.map(m => m.id),
								},
								instanceId: {
									not: null,
								},
							},
						],
					},
				});

				let peopleDone = 0;

				// Spawn sendToServer job for each user
				for (const person of peopleToSendTo) {
					await federationQueue.add("sendToServer", {
						id: statusId,
						user: person,
					});

					peopleDone++;

					await job.updateProgress(
						Math.round((peopleDone / peopleToSendTo.length) * 100)
					);
				}
				break;
			}
			case "sendToServer": {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
				const statusId = job.data.id as string;
				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
				const user = job.data.user as User;

				const status = await client.status.findUnique({
					where: { id: statusId },
					include: statusAndUserRelations,
				});

				if (!status) return;

				const response = await federateStatusTo(
					status,
					status.author,
					user
				);

				if (response.status !== 200) {
					throw new Error(
						`Federation error: ${response.status} ${response.statusText}`
					);
				}

				break;
			}
		}

		await job.updateProgress(100);

		return true;
	},
	{
		connection: {
			host: config.redis.queue.host,
			port: config.redis.queue.port,
			password: config.redis.queue.password,
			db: config.redis.queue.database || undefined,
		},
		removeOnComplete: {
			count: 400,
		},
		removeOnFail: {
			count: 3000,
		},
	}
);

/**
 * Convert a string into an ArrayBuffer
 * from https://developers.google.com/web/updates/2012/06/How-to-convert-ArrayBuffer-to-and-from-String
 */
export const str2ab = (str: string) => {
	const buf = new ArrayBuffer(str.length);
	const bufView = new Uint8Array(buf);
	for (let i = 0, strLen = str.length; i < strLen; i++) {
		bufView[i] = str.charCodeAt(i);
	}
	return buf;
};

export const federateStatusTo = async (
	status: StatusWithRelations,
	sender: User,
	user: User
) => {
	const privateKey = await crypto.subtle.importKey(
		"pkcs8",
		str2ab(atob(user.privateKey ?? "")),
		"Ed25519",
		false,
		["sign"]
	);

	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode("request_body")
	);

	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	const userInbox = new URL((user.endpoints as any).inbox);

	const date = new Date();

	const signature = await crypto.subtle.sign(
		"Ed25519",
		privateKey,
		new TextEncoder().encode(
			`(request-target): post ${userInbox.pathname}\n` +
				`host: ${userInbox.host}\n` +
				`date: ${date.toUTCString()}\n` +
				`digest: SHA-256=${btoa(
					String.fromCharCode(...new Uint8Array(digest))
				)}\n`
		)
	);

	const signatureBase64 = btoa(
		String.fromCharCode(...new Uint8Array(signature))
	);

	return fetch(userInbox, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Date: date.toUTCString(),
			Origin: config.http.base_url,
			Signature: `keyId="${sender.uri}",algorithm="ed25519",headers="(request-target) host date digest",signature="${signatureBase64}"`,
		},
		body: JSON.stringify(statusToLysand(status)),
	});
};

export const addStatusFederationJob = async (statusId: string) => {
	await federationQueue.add("federation", {
		id: statusId,
	});
};
