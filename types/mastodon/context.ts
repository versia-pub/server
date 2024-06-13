import type { Status } from "./status";

export type Context = {
    ancestors: Status[];
    descendants: Status[];
};
