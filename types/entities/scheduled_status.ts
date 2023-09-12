import { APIAttachment } from "./attachment";
import { APIStatusParams } from "./status_params";

export interface APIScheduledStatus {
	id: string;
	scheduled_at: string;
	params: APIStatusParams;
	media_attachments: APIAttachment[];
}
