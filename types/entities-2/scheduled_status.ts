import type { APIAttachment } from "./attachment";
import type { APIStatusParams } from "./status_params";

export interface APIScheduledStatus {
    id: string;
    scheduled_at: string;
    params: APIStatusParams;
    media_attachments: APIAttachment[];
}
