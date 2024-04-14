import type { APIStatus } from "./status";

export interface APIContext {
    ancestors: APIStatus[];
    descendants: APIStatus[];
}
