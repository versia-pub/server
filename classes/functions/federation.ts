import type { Undo } from "@lysand-org/federation/types";
import { config } from "config-manager";
import type { User } from "~/packages/database-interface/user";

export const undoFederationRequest = (undoer: User, uri: string): Undo => {
    const id = crypto.randomUUID();
    return {
        type: "Undo",
        id,
        author: undoer.getUri(),
        created_at: new Date().toISOString(),
        object: uri,
        uri: new URL(`/undos/${id}`, config.http.base_url).toString(),
    };
};
