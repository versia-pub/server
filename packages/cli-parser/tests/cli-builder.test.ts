// FILEPATH: /home/jessew/Dev/lysand/packages/cli-parser/index.test.ts
import { CliCommand, CliBuilder, startsWithArray } from "..";
import { describe, beforeEach, it, expect, jest } from "bun:test";

describe("startsWithArray", () => {
	it("should return true when fullArray starts with startArray", () => {
		const fullArray = ["a", "b", "c", "d", "e"];
		const startArray = ["a", "b", "c"];
		expect(startsWithArray(fullArray, startArray)).toBe(true);
	});

	it("should return false when fullArray does not start with startArray", () => {
		const fullArray = ["a", "b", "c", "d", "e"];
		const startArray = ["b", "c", "d"];
		expect(startsWithArray(fullArray, startArray)).toBe(false);
	});

	it("should return true when startArray is empty", () => {
		const fullArray = ["a", "b", "c", "d", "e"];
		const startArray: any[] = [];
		expect(startsWithArray(fullArray, startArray)).toBe(true);
	});

	it("should return false when fullArray is shorter than startArray", () => {
		const fullArray = ["a", "b", "c"];
		const startArray = ["a", "b", "c", "d", "e"];
		expect(startsWithArray(fullArray, startArray)).toBe(false);
	});
});

describe("CliCommand", () => {
	let cliCommand: CliCommand;

	beforeEach(() => {
		cliCommand = new CliCommand(
			["category1", "category2"],
			[
				{ name: "arg1", type: "string", needsValue: true },
				{ name: "arg2", type: "number", needsValue: true },
				{ name: "arg3", type: "boolean", needsValue: false },
				{ name: "arg4", type: "array", needsValue: true },
			],
			() => {
				// Do nothing
			}
		);
	});

	it("should parse string arguments correctly", () => {
		const args = cliCommand["parseArgs"]([
			"--arg1",
			"value1",
			"--arg2",
			"42",
			"--arg3",
			"--arg4",
			"value1,value2",
		]);
		expect(args).toEqual({
			arg1: "value1",
			arg2: 42,
			arg3: true,
			arg4: ["value1", "value2"],
		});
	});

	it("should cast argument values correctly", () => {
		expect(cliCommand["castArgValue"]("42", "number")).toBe(42);
		expect(cliCommand["castArgValue"]("true", "boolean")).toBe(true);
		expect(cliCommand["castArgValue"]("value1,value2", "array")).toEqual([
			"value1",
			"value2",
		]);
	});

	it("should run the execute function with the parsed parameters", () => {
		const mockExecute = jest.fn();
		cliCommand = new CliCommand(
			["category1", "category2"],
			[
				{ name: "arg1", type: "string", needsValue: true },
				{ name: "arg2", type: "number", needsValue: true },
				{ name: "arg3", type: "boolean", needsValue: false },
				{ name: "arg4", type: "array", needsValue: true },
			],
			mockExecute
		);

		cliCommand.run([
			"--arg1",
			"value1",
			"--arg2",
			"42",
			"--arg3",
			"--arg4",
			"value1,value2",
		]);
		expect(mockExecute).toHaveBeenCalledWith({
			arg1: "value1",
			arg2: 42,
			arg3: true,
			arg4: ["value1", "value2"],
		});
	});

	it("should work with a mix of positioned and non-positioned arguments", () => {
		const mockExecute = jest.fn();
		cliCommand = new CliCommand(
			["category1", "category2"],
			[
				{ name: "arg1", type: "string", needsValue: true },
				{ name: "arg2", type: "number", needsValue: true },
				{ name: "arg3", type: "boolean", needsValue: false },
				{ name: "arg4", type: "array", needsValue: true },
				{
					name: "arg5",
					type: "string",
					needsValue: true,
					positioned: true,
				},
			],
			mockExecute
		);

		cliCommand.run([
			"--arg1",
			"value1",
			"--arg2",
			"42",
			"--arg3",
			"--arg4",
			"value1,value2",
			"value5",
		]);

		expect(mockExecute).toHaveBeenCalledWith({
			arg1: "value1",
			arg2: 42,
			arg3: true,
			arg4: ["value1", "value2"],
			arg5: "value5",
		});
	});
});

describe("CliBuilder", () => {
	let cliBuilder: CliBuilder;
	let mockCommand1: CliCommand;
	let mockCommand2: CliCommand;

	beforeEach(() => {
		mockCommand1 = new CliCommand(["category1"], [], jest.fn());
		mockCommand2 = new CliCommand(["category2"], [], jest.fn());
		cliBuilder = new CliBuilder([mockCommand1]);
	});

	it("should register a command correctly", () => {
		cliBuilder.registerCommand(mockCommand2);
		expect(cliBuilder.commands).toContain(mockCommand2);
	});

	it("should register multiple commands correctly", () => {
		const mockCommand3 = new CliCommand(["category3"], [], jest.fn());
		cliBuilder.registerCommands([mockCommand2, mockCommand3]);
		expect(cliBuilder.commands).toContain(mockCommand2);
		expect(cliBuilder.commands).toContain(mockCommand3);
	});

	it("should error when adding duplicates", () => {
		expect(() => {
			cliBuilder.registerCommand(mockCommand1);
		}).toThrow();

		expect(() => {
			cliBuilder.registerCommands([mockCommand1]);
		}).toThrow();
	});

	it("should deregister a command correctly", () => {
		cliBuilder.deregisterCommand(mockCommand1);
		expect(cliBuilder.commands).not.toContain(mockCommand1);
	});

	it("should deregister multiple commands correctly", () => {
		cliBuilder.registerCommand(mockCommand2);
		cliBuilder.deregisterCommands([mockCommand1, mockCommand2]);
		expect(cliBuilder.commands).not.toContain(mockCommand1);
		expect(cliBuilder.commands).not.toContain(mockCommand2);
	});

	it("should process args correctly", () => {
		const mockExecute = jest.fn();
		const mockCommand = new CliCommand(
			["category1", "sub1"],
			[
				{
					name: "arg1",
					type: "string",
					needsValue: true,
					positioned: false,
				},
			],
			mockExecute
		);
		cliBuilder.registerCommand(mockCommand);
		cliBuilder.processArgs([
			"./cli.ts",
			"category1",
			"sub1",
			"--arg1",
			"value1",
		]);
		expect(mockExecute).toHaveBeenCalledWith({
			arg1: "value1",
		});
	});
});
