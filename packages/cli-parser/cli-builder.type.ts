export interface CliParameter {
	name: string;
	// If not positioned, the argument will need to be called with --name value instead of just value
	positioned?: boolean;
	// Whether the argument needs a value (requires positioned to be false)
	needsValue?: boolean;
	optional?: true;
	type: "string" | "number" | "boolean" | "array";
	description?: string;
}
