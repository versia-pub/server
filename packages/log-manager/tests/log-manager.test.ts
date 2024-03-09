// FILEPATH: /home/jessew/Dev/lysand/packages/log-manager/log-manager.test.ts
import { LogManager, LogLevel } from "../index";
import type fs from "fs/promises";
import {
	describe,
	it,
	beforeEach,
	expect,
	jest,
	mock,
	type Mock,
	test,
} from "bun:test";
import type { BunFile } from "bun";

describe("LogManager", () => {
	let logManager: LogManager;
	let mockOutput: BunFile;
	let mockAppend: Mock<typeof fs.appendFile>;

	beforeEach(async () => {
		mockOutput = Bun.file("test.log");
		mockAppend = jest.fn();
		await mock.module("fs/promises", () => ({
			appendFile: mockAppend,
		}));
		logManager = new LogManager(mockOutput);
	});

	it("should initialize and write init log", () => {
		expect(mockAppend).toHaveBeenCalledWith(
			mockOutput.name,
			expect.stringContaining("--- INIT LogManager at")
		);
	});

	it("should log message with timestamp", async () => {
		await logManager.log(LogLevel.INFO, "TestEntity", "Test message");
		expect(mockAppend).toHaveBeenCalledWith(
			mockOutput.name,
			expect.stringContaining("[INFO] TestEntity: Test message")
		);
	});

	it("should log message without timestamp", async () => {
		await logManager.log(
			LogLevel.INFO,
			"TestEntity",
			"Test message",
			false
		);
		expect(mockAppend).toHaveBeenCalledWith(
			mockOutput.name,
			"[INFO] TestEntity: Test message\n"
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
			expect.stringContaining("[INFO] TestEntity: Test message")
		);
	});

	it("should throw error if output file does not exist", () => {
		mockAppend.mockImplementationOnce(() => {
			return Promise.reject(
				new Error("Output file doesnt exist (and isnt stdout)")
			);
		});
		expect(
			logManager.log(LogLevel.INFO, "TestEntity", "Test message")
		).rejects.toThrow(Error);
	});

	it("should log error message", async () => {
		const error = new Error("Test error");
		await logManager.logError(LogLevel.ERROR, "TestEntity", error);
		expect(mockAppend).toHaveBeenCalledWith(
			mockOutput.name,
			expect.stringContaining("[ERROR] TestEntity: Test error")
		);
	});
});
