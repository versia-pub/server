import type { LysandObjectType } from "./Object";

export interface ExtensionType extends LysandObjectType {
	type: "Extension";
	extension_type: string;
}
