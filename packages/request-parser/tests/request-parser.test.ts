import { describe, expect, it, test } from "bun:test";
import { RequestParser } from "..";

describe("RequestParser", () => {
    describe("Should parse query parameters correctly", () => {
        test("With text parameters", async () => {
            const request = new Request(
                "http://localhost?param1=value1&param2=value2",
            );
            const result = await new RequestParser(request).toObject<{
                param1: string;
                param2: string;
            }>();
            expect(result).toEqual({ param1: "value1", param2: "value2" });
        });

        test("With Array", async () => {
            const request = new Request(
                "http://localhost?test[]=value1&test[]=value2",
            );
            const result = await new RequestParser(request).toObject<{
                test: string[];
            }>();
            expect(result.test).toEqual(["value1", "value2"]);
        });

        test("With Array of objects", async () => {
            const request = new Request(
                "http://localhost?test[][key]=value1&test[][value]=value2",
            );
            const result = await new RequestParser(request).toObject<{
                test: { key: string; value: string }[];
            }>();
            expect(result.test).toEqual([{ key: "value1", value: "value2" }]);
        });

        test("With Array of multiple objects", async () => {
            const request = new Request(
                "http://localhost?test[][key]=value1&test[][value]=value2&test[][key]=value3&test[][value]=value4",
            );
            const result = await new RequestParser(request).toObject<{
                test: { key: string[]; value: string[] }[];
            }>();
            expect(result.test).toEqual([
                { key: ["value1", "value3"], value: ["value2", "value4"] },
            ]);
        });

        test("With both at once", async () => {
            const request = new Request(
                "http://localhost?param1=value1&param2=value2&test[]=value1&test[]=value2",
            );
            const result = await new RequestParser(request).toObject<{
                param1: string;
                param2: string;
                test: string[];
            }>();
            expect(result).toEqual({
                param1: "value1",
                param2: "value2",
                test: ["value1", "value2"],
            });
        });
    });

    it("should parse JSON body correctly", async () => {
        const request = new Request("http://localhost", {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ param1: "value1", param2: "value2" }),
        });
        const result = await new RequestParser(request).toObject<{
            param1: string;
            param2: string;
        }>();
        expect(result).toEqual({ param1: "value1", param2: "value2" });
    });

    it("should handle invalid JSON body", async () => {
        const request = new Request("http://localhost", {
            headers: { "Content-Type": "application/json" },
            body: "invalid json",
        });
        const result = new RequestParser(request).toObject<{
            param1: string;
            param2: string;
        }>();
        expect(result).rejects.toThrow();
    });

    describe("should parse form data correctly", () => {
        test("With basic text parameters", async () => {
            const formData = new FormData();
            formData.append("param1", "value1");
            formData.append("param2", "value2");
            const request = new Request("http://localhost", {
                method: "POST",
                body: formData,
            });
            const result = await new RequestParser(request).toObject<{
                param1: string;
                param2: string;
            }>();
            expect(result).toEqual({ param1: "value1", param2: "value2" });
        });

        test("With File object", async () => {
            const file = new File(["content"], "filename.txt", {
                type: "text/plain",
            });
            const formData = new FormData();
            formData.append("file", file);
            const request = new Request("http://localhost", {
                method: "POST",
                body: formData,
            });
            const result = await new RequestParser(request).toObject<{
                file: File;
            }>();
            expect(result.file).toBeInstanceOf(File);
            expect(await result.file?.text()).toEqual("content");
        });

        test("With Array", async () => {
            const formData = new FormData();
            formData.append("test[]", "value1");
            formData.append("test[]", "value2");
            const request = new Request("http://localhost", {
                method: "POST",
                body: formData,
            });
            const result = await new RequestParser(request).toObject<{
                test: string[];
            }>();
            expect(result.test).toEqual(["value1", "value2"]);
        });

        test("With all three at once", async () => {
            const file = new File(["content"], "filename.txt", {
                type: "text/plain",
            });
            const formData = new FormData();
            formData.append("param1", "value1");
            formData.append("param2", "value2");
            formData.append("file", file);
            formData.append("test[]", "value1");
            formData.append("test[]", "value2");
            const request = new Request("http://localhost", {
                method: "POST",
                body: formData,
            });
            const result = await new RequestParser(request).toObject<{
                param1: string;
                param2: string;
                file: File;
                test: string[];
            }>();
            expect(result).toEqual({
                param1: "value1",
                param2: "value2",
                file: file,
                test: ["value1", "value2"],
            });
        });

        test("URL Encoded", async () => {
            const request = new Request("http://localhost", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: "param1=value1&param2=value2",
            });
            const result = await new RequestParser(request).toObject<{
                param1: string;
                param2: string;
            }>();
            expect(result).toEqual({ param1: "value1", param2: "value2" });
        });
    });
});
