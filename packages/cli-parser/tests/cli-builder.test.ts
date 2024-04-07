import { beforeEach, describe, expect, it, jest, spyOn } from "bun:test";
import stripAnsi from "strip-ansi";
// FILEPATH: /home/jessew/Dev/lysand/packages/cli-parser/index.test.ts
import { CliBuilder, CliCommand, startsWithArray } from "..";
import { CliParameterType } from "../cli-builder.type";

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
        const startArray: string[] = [];
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
                {
                    name: "arg1",
                    type: CliParameterType.STRING,
                    needsValue: true,
                },
                {
                    name: "arg2",
                    shortName: "a",
                    type: CliParameterType.NUMBER,
                    needsValue: true,
                },
                {
                    name: "arg3",
                    type: CliParameterType.BOOLEAN,
                    needsValue: false,
                },
                {
                    name: "arg4",
                    type: CliParameterType.ARRAY,
                    needsValue: true,
                },
            ],
            () => {
                // Do nothing
            },
        );
    });

    it("should parse string arguments correctly", () => {
        // @ts-expect-error Testing private method
        const args = cliCommand.parseArgs([
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

    it("should parse short names for arguments too", () => {
        // @ts-expect-error Testing private method
        const args = cliCommand.parseArgs([
            "--arg1",
            "value1",
            "-a",
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
        // @ts-expect-error Testing private method
        expect(cliCommand.castArgValue("42", CliParameterType.NUMBER)).toBe(42);
        // @ts-expect-error Testing private method
        expect(cliCommand.castArgValue("true", CliParameterType.BOOLEAN)).toBe(
            true,
        );
        expect(
            // @ts-expect-error Testing private method
            cliCommand.castArgValue("value1,value2", CliParameterType.ARRAY),
        ).toEqual(["value1", "value2"]);
    });

    it("should run the execute function with the parsed parameters", async () => {
        const mockExecute = jest.fn();
        cliCommand = new CliCommand(
            ["category1", "category2"],
            [
                {
                    name: "arg1",
                    type: CliParameterType.STRING,
                    needsValue: true,
                },
                {
                    name: "arg2",
                    type: CliParameterType.NUMBER,
                    needsValue: true,
                },
                {
                    name: "arg3",
                    type: CliParameterType.BOOLEAN,
                    needsValue: false,
                },
                {
                    name: "arg4",
                    type: CliParameterType.ARRAY,
                    needsValue: true,
                },
            ],
            mockExecute,
        );

        await cliCommand.run([
            "--arg1",
            "value1",
            "--arg2",
            "42",
            "--arg3",
            "--arg4",
            "value1,value2",
        ]);
        expect(mockExecute).toHaveBeenCalledWith(cliCommand, {
            arg1: "value1",
            arg2: 42,
            arg3: true,
            arg4: ["value1", "value2"],
        });
    });

    it("should work with a mix of positioned and non-positioned arguments", async () => {
        const mockExecute = jest.fn();
        cliCommand = new CliCommand(
            ["category1", "category2"],
            [
                {
                    name: "arg1",
                    type: CliParameterType.STRING,
                    needsValue: true,
                },
                {
                    name: "arg2",
                    type: CliParameterType.NUMBER,
                    needsValue: true,
                },
                {
                    name: "arg3",
                    type: CliParameterType.BOOLEAN,
                    needsValue: false,
                },
                {
                    name: "arg4",
                    type: CliParameterType.ARRAY,
                    needsValue: true,
                },
                {
                    name: "arg5",
                    type: CliParameterType.STRING,
                    needsValue: true,
                    positioned: true,
                },
            ],
            mockExecute,
        );

        await cliCommand.run([
            "--arg1",
            "value1",
            "--arg2",
            "42",
            "--arg3",
            "--arg4",
            "value1,value2",
            "value5",
        ]);

        expect(mockExecute).toHaveBeenCalledWith(cliCommand, {
            arg1: "value1",
            arg2: 42,
            arg3: true,
            arg4: ["value1", "value2"],
            arg5: "value5",
        });
    });

    it("should display help message correctly", () => {
        const consoleLogSpy = spyOn(console, "log").mockImplementation(() => {
            // Do nothing
        });

        cliCommand = new CliCommand(
            ["category1", "category2"],
            [
                {
                    name: "arg1",
                    type: CliParameterType.STRING,
                    needsValue: true,
                    description: "Argument 1",
                    optional: true,
                },
                {
                    name: "arg2",
                    type: CliParameterType.NUMBER,
                    needsValue: true,
                    description: "Argument 2",
                },
                {
                    name: "arg3",
                    type: CliParameterType.BOOLEAN,
                    needsValue: false,
                    description: "Argument 3",
                    optional: true,
                    positioned: false,
                },
                {
                    name: "arg4",
                    type: CliParameterType.ARRAY,
                    needsValue: true,
                    description: "Argument 4",
                    positioned: false,
                },
            ],
            () => {
                // Do nothing
            },
            "This is a test command",
            "category1 category2 --arg1 value1 --arg2 42 arg3 --arg4 value1,value2",
        );

        cliCommand.displayHelp();

        const loggedString = consoleLogSpy.mock.calls.map((call) =>
            stripAnsi(call[0]),
        )[0];

        consoleLogSpy.mockRestore();

        expect(loggedString).toContain("📚 Command: category1 category2");
        expect(loggedString).toContain("🔧 Arguments:");
        expect(loggedString).toContain("arg1: Argument 1 (optional)");
        expect(loggedString).toContain("arg2: Argument 2");
        expect(loggedString).toContain("--arg3: Argument 3 (optional)");
        expect(loggedString).toContain("--arg4: Argument 4");
        expect(loggedString).toContain("🚀 Example:");
        expect(loggedString).toContain(
            "category1 category2 --arg1 value1 --arg2 42 arg3 --arg4 value1,value2",
        );
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

    it("should process args correctly", async () => {
        const mockExecute = jest.fn();
        const mockCommand = new CliCommand(
            ["category1", "sub1"],
            [
                {
                    name: "arg1",
                    type: CliParameterType.STRING,
                    needsValue: true,
                    positioned: false,
                },
            ],
            mockExecute,
        );
        cliBuilder.registerCommand(mockCommand);
        await cliBuilder.processArgs([
            "./cli.ts",
            "category1",
            "sub1",
            "--arg1",
            "value1",
        ]);
        expect(mockExecute).toHaveBeenCalledWith(expect.anything(), {
            arg1: "value1",
        });
    });

    describe("should build command tree", () => {
        let cliBuilder: CliBuilder;
        let mockCommand1: CliCommand;
        let mockCommand2: CliCommand;
        let mockCommand3: CliCommand;
        let mockCommand4: CliCommand;
        let mockCommand5: CliCommand;

        beforeEach(() => {
            mockCommand1 = new CliCommand(["user", "verify"], [], jest.fn());
            mockCommand2 = new CliCommand(["user", "delete"], [], jest.fn());
            mockCommand3 = new CliCommand(
                ["user", "new", "admin"],
                [],
                jest.fn(),
            );
            mockCommand4 = new CliCommand(["user", "new"], [], jest.fn());
            mockCommand5 = new CliCommand(["admin", "delete"], [], jest.fn());
            cliBuilder = new CliBuilder([
                mockCommand1,
                mockCommand2,
                mockCommand3,
                mockCommand4,
                mockCommand5,
            ]);
        });

        it("should build the command tree correctly", () => {
            const tree = cliBuilder.getCommandTree(cliBuilder.commands);
            expect(tree).toEqual({
                user: {
                    verify: mockCommand1,
                    delete: mockCommand2,
                    new: {
                        admin: mockCommand3,
                    },
                },
                admin: {
                    delete: mockCommand5,
                },
            });
        });

        it("should build the command tree correctly when there are no commands", () => {
            cliBuilder = new CliBuilder([]);
            const tree = cliBuilder.getCommandTree(cliBuilder.commands);
            expect(tree).toEqual({});
        });

        it("should build the command tree correctly when there is only one command", () => {
            cliBuilder = new CliBuilder([mockCommand1]);
            const tree = cliBuilder.getCommandTree(cliBuilder.commands);
            expect(tree).toEqual({
                user: {
                    verify: mockCommand1,
                },
            });
        });
    });

    it("should show help menu", () => {
        const consoleLogSpy = spyOn(console, "log").mockImplementation(() => {
            // Do nothing
        });

        const cliBuilder = new CliBuilder();

        const cliCommand = new CliCommand(
            ["category1", "category2"],
            [
                {
                    name: "name",
                    type: CliParameterType.STRING,
                    needsValue: true,
                    description: "Name of new item",
                },
                {
                    name: "delete-previous",
                    type: CliParameterType.NUMBER,
                    needsValue: false,
                    positioned: false,
                    optional: true,
                    description: "Also delete the previous item",
                },
                {
                    name: "arg3",
                    type: CliParameterType.BOOLEAN,
                    needsValue: false,
                },
                {
                    name: "arg4",
                    type: CliParameterType.ARRAY,
                    needsValue: true,
                },
            ],
            () => {
                // Do nothing
            },
            "I love sussy sauces",
            "emoji add --url https://site.com/image.png",
        );

        cliBuilder.registerCommand(cliCommand);
        cliBuilder.displayHelp();

        const loggedString = consoleLogSpy.mock.calls
            .map((call) => stripAnsi(call[0]))
            .join("\n");

        consoleLogSpy.mockRestore();

        expect(loggedString).toContain("category1");
        expect(loggedString).toContain(
            "    category2.................I love sussy sauces",
        );
        expect(loggedString).toContain(
            "    name..................Name of new item",
        );
        expect(loggedString).toContain(
            "    arg3..................(no description)",
        );
        expect(loggedString).toContain(
            "    arg4..................(no description)",
        );
        expect(loggedString).toContain(
            "    --delete-previous.....Also delete the previous item (optional)",
        );
        expect(loggedString).toContain(
            "    Example: emoji add --url https://site.com/image.png",
        );
    });
});
