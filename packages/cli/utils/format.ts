import chalk from "chalk";
import { getBorderCharacters, table } from "table";

/**
 * Given a JS array, return a string output to be passed to console.log
 * @param arr The array to be formatted
 * @param keys The keys to be displayed (removes all other keys from the output)
 * @param type Either "json", "csv" or nothing for a table
 * @returns The formatted string
 */
export const formatArray = (
    arr: Record<string, unknown>[],
    keys: string[],
    type?: "json" | "csv",
    prettyDates = false,
): string => {
    const output = arr.map((item) => {
        const newItem = {} as Record<string, unknown>;

        for (const key of keys) {
            newItem[key] = item[key];
        }

        return newItem;
    });

    if (prettyDates) {
        for (const item of output) {
            for (const key of keys) {
                const value = item[key];
                // If this is an ISO string, convert it to a nice date
                if (
                    typeof value === "string" &&
                    value.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}.\d{3}$/)
                ) {
                    item[key] = Intl.DateTimeFormat(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                    }).format(new Date(value));
                    // Format using Chalk
                    item[key] = chalk.underline(item[key]);
                }
            }
        }
    }

    switch (type) {
        case "json":
            return JSON.stringify(output, null, 2);
        case "csv":
            return `${keys.join(",")}\n${output
                .map((item) => keys.map((key) => item[key]).join(","))
                .join("\n")}`;
        default:
            // Convert output to array of arrays for table
            return table(
                [
                    keys.map((k) => chalk.bold(k)),
                    ...output.map((item) => keys.map((key) => item[key])),
                ],
                {
                    border: getBorderCharacters("norc"),
                },
            );
    }
};
