import { ExtensionType } from "../../Extension";

export interface OrgLysandReactionsType extends ExtensionType {
	extension_type: "org.lysand:reactions/Reaction";
	author: string;
	object: string;
	content: string;
}
