import { APIField } from "./field";

export interface APISource {
	privacy: string | null;
	sensitive: boolean | null;
	language: string | null;
	note: string;
	fields: APIField[];
}
