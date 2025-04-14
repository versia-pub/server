import { dirname } from "node:path";
import { main } from "bun";

type ElementWithId = { id: string };

export const mergeAndDeduplicate = <T extends ElementWithId>(
    ...elements: T[][]
): T[] =>
    elements
        .reduce((acc, val) => acc.concat(val), [])
        .filter(
            (element, index, self) =>
                index === self.findIndex((t) => t.id === element.id),
        );

export const cwdFromEntrypoint = (): string => {
    return dirname(main);
};
