import { Attachment } from "./attachment";
import { StatusParams } from "./status_params";

export interface ScheduledStatus {
	id: string;
	scheduled_at: string;
	params: StatusParams;
	media_attachments: Attachment[];
}
