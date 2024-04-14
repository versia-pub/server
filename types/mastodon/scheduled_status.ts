import type { Attachment } from "./attachment";
import type { StatusParams } from "./status_params";

export type ScheduledStatus = {
    id: string;
    scheduled_at: string;
    params: StatusParams;
    media_attachments: Array<Attachment> | null;
};
