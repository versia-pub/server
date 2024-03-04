export const deepMerge = (
	target: Record<string, any>,
	source: Record<string, any>
) => {
	const result = { ...target, ...source };
	for (const key of Object.keys(result)) {
		result[key] =
			typeof target[key] == "object" && typeof source[key] == "object"
				? deepMerge(target[key], source[key])
				: structuredClone(result[key]);
	}
	return result;
};

export const deepMergeArray = (array: Record<string, any>[]) =>
	array.reduce((ci, ni) => deepMerge(ci, ni), {});
