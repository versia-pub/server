import type { APIMeta } from "./attachment";

export interface APIAsyncAttachment {
	id: string;
	type: "unknown" | "image" | "gifv" | "video" | "audio";
	url: string | null;
	remote_url: string | null;
	preview_url: string;
	text_url: string | null;
	meta: APIMeta | null;
	description: string | null;
	blurhash: string | null;
}
