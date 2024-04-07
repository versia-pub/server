import {
    type Mock,
    beforeEach,
    describe,
    expect,
    it,
    jest,
    mock,
    test,
} from "bun:test";
import type fs from "node:fs/promises";
import type { BunFile } from "bun";
// FILEPATH: /home/jessew/Dev/lysand/packages/log-manager/log-manager.test.ts
import { LogLevel, LogManager, MultiLogManager } from "../index";

describe("LogManager", () => {
    let logManager: LogManager;
    let mockOutput: BunFile;
    let mockAppend: Mock<typeof fs.appendFile>;

    beforeEach(async () => {
        mockOutput = Bun.file("test.log");
        mockAppend = jest.fn();
        await mock.module("node:fs/promises", () => ({
            appendFile: mockAppend,
        }));
        logManager = new LogManager(mockOutput);
    });

    /*     it("should initialize and write init log", () => {
        new LogManager(mockOutput);
        expect(mockAppend).toHaveBeenCalledWith(
            mockOutput.name,
            expect.stringContaining("--- INIT LogManager at"),
        );
    });
 */
    it("should log message with timestamp", async () => {
        await logManager.log(LogLevel.INFO, "TestEntity", "Test message");
        expect(mockAppend).toHaveBeenCalledWith(
            mockOutput.name,
            expect.stringContaining("[INFO] TestEntity: Test message"),
        );
    });

    it("should log message without timestamp", async () => {
        await logManager.log(
            LogLevel.INFO,
            "TestEntity",
            "Test message",
            false,
        );
        expect(mockAppend).toHaveBeenCalledWith(
            mockOutput.name,
            "[INFO] TestEntity: Test message\n",
        );
    });

    test.skip("should write to stdout", async () => {
        logManager = new LogManager(Bun.stdout);
        await logManager.log(LogLevel.INFO, "TestEntity", "Test message");

        const writeMock = jest.fn();

        await mock.module("Bun", () => ({
            stdout: Bun.stdout,
            write: writeMock,
        }));

        expect(writeMock).toHaveBeenCalledWith(
            Bun.stdout,
            expect.stringContaining("[INFO] TestEntity: Test message"),
        );
    });

    it("should log error message", async () => {
        const error = new Error("Test error");
        await logManager.logError(LogLevel.ERROR, "TestEntity", error);
        expect(mockAppend).toHaveBeenCalledWith(
            mockOutput.name,
            expect.stringContaining("[ERROR] TestEntity: Test error"),
        );
    });

    it("should log basic request details", async () => {
        const req = new Request("http://localhost/test", { method: "GET" });
        await logManager.logRequest(req, "127.0.0.1");

        expect(mockAppend).toHaveBeenCalledWith(
            mockOutput.name,
            expect.stringContaining("127.0.0.1: GET http://localhost/test"),
        );
    });

    describe("Request logger", () => {
        it("should log all request details for JSON content type", async () => {
            const req = new Request("http://localhost/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ test: "value" }),
            });
            await logManager.logRequest(req, "127.0.0.1", true);

            const expectedLog = `127.0.0.1: POST http://localhost/test
  [Headers]
    content-type: application/json
  [Body]
    {
        "test": "value"
    }
`;

            expect(mockAppend).toHaveBeenCalledWith(
                mockOutput.name,
                expect.stringContaining(expectedLog),
            );
        });

        it("should log all request details for text content type", async () => {
            const req = new Request("http://localhost/test", {
                method: "POST",
                headers: { "Content-Type": "text/plain" },
                body: "Test body",
            });
            await logManager.logRequest(req, "127.0.0.1", true);

            const expectedLog = `127.0.0.1: POST http://localhost/test
  [Headers]
    content-type: text/plain
  [Body]
    Test body
`;
            expect(mockAppend).toHaveBeenCalledWith(
                mockOutput.name,
                expect.stringContaining(expectedLog),
            );
        });

        it("should log all request details for FormData content-type", async () => {
            const formData = new FormData();
            formData.append("test", "value");
            const req = new Request("http://localhost/test", {
                method: "POST",
                body: formData,
            });
            await logManager.logRequest(req, "127.0.0.1", true);

            const expectedLog = `127.0.0.1: POST http://localhost/test
  [Headers]
    content-type: multipart/form-data; boundary=${
        req.headers.get("Content-Type")?.split("boundary=")[1] ?? ""
    }
  [Body]
    test: value
`;

            expect(mockAppend).toHaveBeenCalledWith(
                mockOutput.name,
                expect.stringContaining(
                    expectedLog.replace("----", expect.any(String)),
                ),
            );
        });
    });
});

describe("MultiLogManager", () => {
    let multiLogManager: MultiLogManager;
    let mockLogManagers: LogManager[];
    let mockLog: jest.Mock;
    let mockLogError: jest.Mock;
    let mockLogRequest: jest.Mock;

    beforeEach(() => {
        mockLog = jest.fn();
        mockLogError = jest.fn();
        mockLogRequest = jest.fn();
        mockLogManagers = [
            {
                log: mockLog,
                logError: mockLogError,
                logRequest: mockLogRequest,
            },
            {
                log: mockLog,
                logError: mockLogError,
                logRequest: mockLogRequest,
            },
        ] as unknown as LogManager[];
        multiLogManager = MultiLogManager.fromLogManagers(...mockLogManagers);
    });

    it("should log message to all logManagers", async () => {
        await multiLogManager.log(LogLevel.INFO, "TestEntity", "Test message");
        expect(mockLog).toHaveBeenCalledTimes(2);
        expect(mockLog).toHaveBeenCalledWith(
            LogLevel.INFO,
            "TestEntity",
            "Test message",
            true,
        );
    });

    it("should log error to all logManagers", async () => {
        const error = new Error("Test error");
        await multiLogManager.logError(LogLevel.ERROR, "TestEntity", error);
        expect(mockLogError).toHaveBeenCalledTimes(2);
        expect(mockLogError).toHaveBeenCalledWith(
            LogLevel.ERROR,
            "TestEntity",
            error,
        );
    });

    it("should log request to all logManagers", async () => {
        const req = new Request("http://localhost/test", { method: "GET" });
        await multiLogManager.logRequest(req, "127.0.0.1", true);
        expect(mockLogRequest).toHaveBeenCalledTimes(2);
        expect(mockLogRequest).toHaveBeenCalledWith(req, "127.0.0.1", true);
    });
});
