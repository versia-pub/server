import type { ContentFormat } from "../../Object";

export interface Emoji {
	name: string;
	url: ContentFormat[];
	alt?: string;
}
