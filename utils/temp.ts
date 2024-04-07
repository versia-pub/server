import { exists, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const writeToTempDirectory = async (filename: string, data: string) => {
    const tempDir = join("/tmp/", "lysand");
    if (!(await exists(tempDir))) await mkdir(tempDir);

    const tempFile = join(tempDir, filename);
    await writeFile(tempFile, data);

    return tempFile;
};

export const readFromTempDirectory = async (filename: string) => {
    const tempDir = join("/tmp/", "lysand");
    if (!(await exists(tempDir))) await mkdir(tempDir);

    const tempFile = join(tempDir, filename);
    return readFile(tempFile, "utf-8");
};
