/**
 * Takes a request, and turns FormData or query parameters
 * into a JSON object as would be returned by req.json()
 * This is a translation layer that allows clients to use
 * either FormData, query parameters, or JSON in the request
 * @param request The request to parse
 */
export async function parseRequest<T>(request: Request): Promise<Partial<T>> {
	const query = new URL(request.url).searchParams;

	// Parse SearchParams arrays into JSON arrays
	const arrayKeys = [...query.keys()].filter(key => key.endsWith("[]"));

	for (const key of arrayKeys) {
		const value = query.getAll(key);
		query.delete(key);
		query.append(key, JSON.stringify(value));
	}

	// If body is empty
	if (request.body === null) {
		return {};
	}

	// if request contains a JSON body
	if (request.headers.get("Content-Type")?.includes("application/json")) {
		return (await request.json()) as T;
	}

	// If request contains FormData
	if (request.headers.get("Content-Type")?.includes("multipart/form-data")) {
		const formData = await request.formData();

		if ([...formData.entries()].length > 0) {
			const data: Record<string, string | File> = {};

			for (const [key, value] of formData.entries()) {
				// If object, parse as JSON
				try {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-base-to-string
					data[key] = JSON.parse(value.toString());
				} catch {
					// If a file, set as a file
					if (value instanceof File) {
						data[key] = value;
					} else {
						// Otherwise, set as a string
						// eslint-disable-next-line @typescript-eslint/no-base-to-string
						data[key] = value.toString();
					}
				}
			}

			return data as T;
		}
	}

	if ([...query.entries()].length > 0) {
		const data: Record<string, string | string[]> = {};

		for (const [key, value] of query.entries()) {
			try {
				data[key] = JSON.parse(value) as string[];
			} catch {
				data[key] = value.toString();
			}
		}

		return data as T;
	}

	return {};
}
