import { Status } from "./status";

export interface Context {
	ancestors: Status[];
	descendants: Status[];
}
