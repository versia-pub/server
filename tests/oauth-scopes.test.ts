import { describe, expect, it } from "bun:test";
import { checkIfOauthIsValid } from "@oauth";
import type { Application } from "~database/entities/Application";

describe("checkIfOauthIsValid", () => {
    it("should return true when routeScopes and application.scopes are empty", () => {
        const application = { scopes: "" };
        const routeScopes: string[] = [];
        const result = checkIfOauthIsValid(
            application as Application,
            routeScopes,
        );
        expect(result).toBe(true);
    });

    it("should return true when routeScopes is empty and application.scopes contains write:* or write", () => {
        const application = { scopes: "write:*" };
        const routeScopes: string[] = [];
        const result = checkIfOauthIsValid(
            application as Application,
            routeScopes,
        );
        expect(result).toBe(true);
    });

    it("should return true when routeScopes is empty and application.scopes contains read:* or read", () => {
        const application = { scopes: "read:*" };
        const routeScopes: string[] = [];
        const result = checkIfOauthIsValid(
            application as Application,
            routeScopes,
        );
        expect(result).toBe(true);
    });

    it("should return true when routeScopes contains only write: permissions and application.scopes contains write:* or write", () => {
        const application = { scopes: "write:*" };
        const routeScopes = ["write:users", "write:posts"];
        const result = checkIfOauthIsValid(
            application as Application,
            routeScopes,
        );
        expect(result).toBe(true);
    });

    it("should return true when routeScopes contains only read: permissions and application.scopes contains read:* or read", () => {
        const application = { scopes: "read:*" };
        const routeScopes = ["read:users", "read:posts"];
        const result = checkIfOauthIsValid(
            application as Application,
            routeScopes,
        );
        expect(result).toBe(true);
    });

    it("should return true when routeScopes contains both write: and read: permissions and application.scopes contains write:* or write and read:* or read", () => {
        const application = { scopes: "write:* read:*" };
        const routeScopes = ["write:users", "read:posts"];
        const result = checkIfOauthIsValid(
            application as Application,
            routeScopes,
        );
        expect(result).toBe(true);
    });

    it("should return false when routeScopes contains write: permissions but application.scopes does not contain write:* or write", () => {
        const application = { scopes: "read:*" };
        const routeScopes = ["write:users", "write:posts"];
        const result = checkIfOauthIsValid(
            application as Application,
            routeScopes,
        );
        expect(result).toBe(false);
    });

    it("should return false when routeScopes contains read: permissions but application.scopes does not contain read:* or read", () => {
        const application = { scopes: "write:*" };
        const routeScopes = ["read:users", "read:posts"];
        const result = checkIfOauthIsValid(
            application as Application,
            routeScopes,
        );
        expect(result).toBe(false);
    });

    it("should return false when routeScopes contains both write: and read: permissions but application.scopes does not contain write:* or write and read:* or read", () => {
        const application = { scopes: "" };
        const routeScopes = ["write:users", "read:posts"];
        const result = checkIfOauthIsValid(
            application as Application,
            routeScopes,
        );
        expect(result).toBe(false);
    });

    it("should return true when routeScopes contains a mix of valid and invalid permissions and application.scopes contains all the required permissions", () => {
        const application = { scopes: "write:* read:*" };
        const routeScopes = ["write:users", "invalid:permission", "read:posts"];
        const result = checkIfOauthIsValid(
            application as Application,
            routeScopes,
        );
        expect(result).toBe(true);
    });

    it("should return false when routeScopes contains a mix of valid and invalid permissions but application.scopes does not contain all the required permissions", () => {
        const application = { scopes: "write:*" };
        const routeScopes = ["write:users", "invalid:permission", "read:posts"];
        const result = checkIfOauthIsValid(
            application as Application,
            routeScopes,
        );
        expect(result).toBe(false);
    });

    it("should return true when routeScopes contains a mix of valid write and read permissions and application.scopes contains all the required permissions", () => {
        const application = { scopes: "write:* read:posts" };
        const routeScopes = ["write:users", "read:posts"];
        const result = checkIfOauthIsValid(
            application as Application,
            routeScopes,
        );
        expect(result).toBe(true);
    });

    it("should return false when routeScopes contains a mix of valid write and read permissions but application.scopes does not contain all the required permissions", () => {
        const application = { scopes: "write:*" };
        const routeScopes = ["write:users", "read:posts"];
        const result = checkIfOauthIsValid(
            application as Application,
            routeScopes,
        );
        expect(result).toBe(false);
    });
});
