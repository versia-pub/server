import type { APActor, APNote } from "activitypub-types";
import { ActivityPubTranslator } from "./protocols/activitypub";

export enum SupportedProtocols {
    ACTIVITYPUB = "activitypub",
}

/**
 * ProtocolTranslator
 * @summary Translates between federation protocols such as ActivityPub to Lysand and back
 * @description This class is responsible for translating between federation protocols such as ActivityPub to Lysand and back.
 * This class is not meant to be instantiated directly, but rather for its children to be used.
 */
export class ProtocolTranslator {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    static auto(object: any) {
        const protocol = ProtocolTranslator.recognizeProtocol(object);
        switch (protocol) {
            case SupportedProtocols.ACTIVITYPUB:
                return new ActivityPubTranslator();
            default:
                throw new Error("Unknown protocol");
        }
    }

    /**
     * Translates an ActivityPub actor to a Lysand user
     * @param data Raw JSON-LD data from an ActivityPub actor
     */
    user(data: APActor) {
        //
    }

    /**
     * Translates an ActivityPub note to a Lysand status
     * @param data Raw JSON-LD data from an ActivityPub note
     */
    status(data: APNote) {
        //
    }

    /**
     * Automatically recognizes the protocol of a given object
     */

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    private static recognizeProtocol(object: any) {
        // Temporary stub
        return SupportedProtocols.ACTIVITYPUB;
    }
}
