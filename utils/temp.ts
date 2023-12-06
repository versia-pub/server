import { join } from "path";
import { exists, mkdir, writeFile, readFile } from "fs/promises";

export const writeToTempDirectory = async (filename: string, data: string) => {
	const tempDir = join(process.cwd(), "temp");
	if (!(await exists(tempDir))) await mkdir(tempDir);

	const tempFile = join(tempDir, filename);
	await writeFile(tempFile, data);

	return tempFile;
};

export const readFromTempDirectory = async (filename: string) => {
	const tempDir = join(process.cwd(), "temp");
	if (!(await exists(tempDir))) await mkdir(tempDir);

	const tempFile = join(tempDir, filename);
	return readFile(tempFile, "utf-8");
};
