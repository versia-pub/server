import { getConfig } from "@config";
import chalk from "chalk";
import { client } from "~database/datasource";
import { Meilisearch } from "meilisearch";

const config = getConfig();

export const meilisearch = new Meilisearch({
	host: `${config.meilisearch.host}:${config.meilisearch.port}`,
	apiKey: config.meilisearch.api_key,
});

export const connectMeili = async () => {
	if (!config.meilisearch.enabled) return;

	if (await meilisearch.isHealthy()) {
		console.log(
			`${chalk.green(`✓`)} ${chalk.bold(`Connected to Meilisearch`)}`
		);
	} else {
		console.error(
			`${chalk.red(`✗`)} ${chalk.bold(
				`Error while connecting to Meilisearch`
			)}`
		);
		process.exit(1);
	}
};

export enum SonicIndexType {
	Accounts = "accounts",
	Statuses = "statuses",
}

export const getNthDatabaseAccountBatch = (
	n: number,
	batchSize = 1000
): Promise<Record<string, string>[]> => {
	return client.user.findMany({
		skip: n * batchSize,
		take: batchSize,
		select: {
			id: true,
			username: true,
			displayName: true,
			note: true,
		},
	});
};

export const getNthDatabaseStatusBatch = (
	n: number,
	batchSize = 1000
): Promise<Record<string, string>[]> => {
	return client.status.findMany({
		skip: n * batchSize,
		take: batchSize,
		select: {
			id: true,
			authorId: true,
			content: true,
		},
	});
};

export const rebuildSearchIndexes = async (
	indexes: SonicIndexType[],
	batchSize = 100
) => {
	if (indexes.includes(SonicIndexType.Accounts)) {
		// await sonicIngestor.flushc(SonicIndexType.Accounts);

		const accountCount = await client.user.count();

		for (let i = 0; i < accountCount / batchSize; i++) {
			const accounts = await getNthDatabaseAccountBatch(i, batchSize);

			const progress = Math.round((i / (accountCount / batchSize)) * 100);

			console.log(`${chalk.green(`✓`)} ${progress}%`);

			// Sync with Meilisearch
			await meilisearch
				.index(SonicIndexType.Accounts)
				.addDocuments(accounts);
		}

		console.log(`${chalk.green(`✓`)} ${chalk.bold(`Done!`)}`);
	}

	if (indexes.includes(SonicIndexType.Statuses)) {
		// await sonicIngestor.flushc(SonicIndexType.Statuses);

		const statusCount = await client.status.count();

		for (let i = 0; i < statusCount / batchSize; i++) {
			const statuses = await getNthDatabaseStatusBatch(i, batchSize);

			const progress = Math.round((i / (statusCount / batchSize)) * 100);

			console.log(`${chalk.green(`✓`)} ${progress}%`);

			// Sync with Meilisearch
			await meilisearch
				.index(SonicIndexType.Statuses)
				.addDocuments(statuses);
		}

		console.log(`${chalk.green(`✓`)} ${chalk.bold(`Done!`)}`);
	}
};
