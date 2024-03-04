/**
 * Takes a request, and turns FormData or query parameters
 * into a JSON object as would be returned by req.json()
 * This is a translation layer that allows clients to use
 * either FormData, query parameters, or JSON in the request
 * @param request The request to parse
 */
export async function parseRequest<T>(request: Request): Promise<Partial<T>> {
	const query = new URL(request.url).searchParams;
	let output: Partial<T> = {};

	// Parse SearchParams arrays into JSON arrays
	const arrayKeys = [...query.keys()].filter(key => key.endsWith("[]"));
	const nonArrayKeys = [...query.keys()].filter(key => !key.endsWith("[]"));

	for (const key of arrayKeys) {
		const value = query.getAll(key);
		query.delete(key);
		query.append(key, JSON.stringify(value));
	}

	// Append non array keys to output
	for (const key of nonArrayKeys) {
		// @ts-expect-error Complains about type
		output[key] = query.get(key);
	}

	const queryEntries = [...query.entries()];

	if (queryEntries.length > 0) {
		const data: Record<string, string | string[]> = {};

		const arrayKeys = [...query.keys()].filter(key => key.endsWith("[]"));

		for (const key of arrayKeys) {
			const value = query.getAll(key);
			query.delete(key);
			// @ts-expect-error JSON arrays are valid
			data[key] = JSON.parse(value);
		}

		output = {
			...output,
			...(data as T),
		};
	}

	// if request contains a JSON body
	if (request.headers.get("Content-Type")?.includes("application/json")) {
		try {
			output = {
				...output,
				...((await request.json()) as T),
			};
		} catch {
			// Invalid JSON
		}
	}

	// If request contains FormData
	if (request.headers.get("Content-Type")?.includes("multipart/form-data")) {
		// @ts-expect-error It hates entries() for some reason
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call
		const formData = [...(await request.formData()).entries()];

		if (formData.length > 0) {
			const data: Record<string, string | File> = {};

			for (const [key, value] of formData) {
				// If object, parse as JSON
				try {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-base-to-string, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
					data[key] = JSON.parse(value.toString());
				} catch {
					// If a file, set as a file
					if (value instanceof File) {
						// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
						data[key] = value;
					} else {
						// Otherwise, set as a string
						// eslint-disable-next-line @typescript-eslint/no-base-to-string, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
						data[key] = value.toString();
					}
				}
			}

			output = {
				...output,
				...(data as T),
			};
		}
	}

	return output;
}
