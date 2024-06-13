import type { History } from "./history";

export type Tag = {
    name: string;
    url: string;
    history: History[];
    following?: boolean;
};
