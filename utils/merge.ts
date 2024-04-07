export const deepMerge = (
    target: Record<string, unknown>,
    source: Record<string, unknown>,
) => {
    const result = { ...target, ...source };
    for (const key of Object.keys(result)) {
        result[key] =
            typeof target[key] === "object" && typeof source[key] === "object"
                ? // @ts-expect-error deepMerge is recursive
                  deepMerge(target[key], source[key])
                : structuredClone(result[key]);
    }
    return result;
};

export const deepMergeArray = (array: Record<string, unknown>[]) =>
    array.reduce((ci, ni) => deepMerge(ci, ni), {});
