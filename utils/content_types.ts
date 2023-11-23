import type { ContentFormat } from "~types/lysand/Object";

export const getBestContentType = (contents: ContentFormat[]) => {
	// Find the best content and content type
	if (contents.find(c => c.content_type === "text/x.misskeymarkdown")) {
		return (
			contents.find(c => c.content_type === "text/x.misskeymarkdown") ||
			null
		);
	} else if (contents.find(c => c.content_type === "text/html")) {
		return contents.find(c => c.content_type === "text/html") || null;
	} else if (contents.find(c => c.content_type === "text/markdown")) {
		return contents.find(c => c.content_type === "text/markdown") || null;
	} else if (contents.find(c => c.content_type === "text/plain")) {
		return contents.find(c => c.content_type === "text/plain") || null;
	} else {
		return contents[0] || null;
	}
};
