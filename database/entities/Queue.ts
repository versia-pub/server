import { config } from "config-manager";
// import { Worker } from "bullmq";

/* export const federationWorker = new Worker(
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
); */

export const addStatusFederationJob = async (statusId: string) => {
    /* await federationQueue.add("federation", {
		id: statusId,
	}); */
};
