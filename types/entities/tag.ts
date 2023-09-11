import { History } from "./history";

export interface Tag {
	name: string;
	url: string;
	history: History[];
	following?: boolean;
}
