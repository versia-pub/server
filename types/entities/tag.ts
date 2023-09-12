import { APIHistory } from "./history";

export interface APITag {
	name: string;
	url: string;
	history: APIHistory[];
	following?: boolean;
}
