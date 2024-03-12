export interface CliParameter {
	name: string;
	/* Like -v for --version */
	shortName?: string;
	/**
	 * If not positioned, the argument will need to be called with --name value instead of just value
	 * @default true
	 */
	positioned?: boolean;
	/* Whether the argument needs a value (requires positioned to be false) */
	needsValue?: boolean;
	optional?: true;
	type: CliParameterType;
	description?: string;
}

export enum CliParameterType {
	STRING = "string",
	NUMBER = "number",
	BOOLEAN = "boolean",
	ARRAY = "array",
	EMPTY = "empty",
}
