import type { ExtensionType } from "../../Extension";

export interface OrgLysandPollsVoteType extends ExtensionType {
    extension_type: "org.lysand:polls/Vote";
    author: string;
    poll: string;
    option: number;
}

export interface OrgLysandPollsVoteResultType extends ExtensionType {
    extension_type: "org.lysand:polls/VoteResult";
    poll: string;
    votes: number[];
}
