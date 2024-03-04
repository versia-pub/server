/**
 * Usage: TOKEN=your_token_here bun benchmark:timeline <request_count>
 */

import { getConfig } from "~classes/configmanager";
import chalk from "chalk";

const config = getConfig();

const token = process.env.TOKEN;
const requestCount = Number(process.argv[2]) || 100;

if (!token) {
	console.log(
		`${chalk.red(
			"✗"
		)} No token provided. Provide one via the TOKEN environment variable.`
	);
	process.exit(1);
}

const fetchTimeline = () =>
	fetch(`${config.http.base_url}/api/v1/timelines/home`, {
		headers: {
			Authorization: `Bearer ${token}`,
		},
	}).then(res => res.ok);

const timeNow = performance.now();

const requests = Array.from({ length: requestCount }, () => fetchTimeline());

Promise.all(requests)
	.then(results => {
		const timeTaken = performance.now() - timeNow;
		if (results.every(t => t)) {
			console.log(`${chalk.green("✓")} All requests succeeded`);
		} else {
			console.log(
				`${chalk.red("✗")} ${
					results.filter(t => !t).length
				} requests failed`
			);
		}
		console.log(
			`${chalk.green("✓")} ${
				requests.length
			} requests fulfilled in ${chalk.bold(
				(timeTaken / 1000).toFixed(5)
			)}s`
		);
	})
	.catch(err => {
		console.log(`${chalk.red("✗")} ${err}`);
		process.exit(1);
	});
