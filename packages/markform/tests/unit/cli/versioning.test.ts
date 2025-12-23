/**
 * Tests for versioning utilities.
 */

import { existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import {
  generateVersionedPath,
  incrementVersion,
  parseVersionedPath,
} from "../../../src/cli/lib/versioning.js";

// Mock fs.existsSync for testing generateVersionedPath
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

describe("versioning", () => {
  describe("parseVersionedPath", () => {
    it("parses file without version", () => {
      const result = parseVersionedPath("form.form.md");
      expect(result).toEqual({
        base: "form",
        version: null,
        extension: ".form.md",
      });
    });

    it("parses file with -v1 version", () => {
      const result = parseVersionedPath("form-v1.form.md");
      expect(result).toEqual({
        base: "form",
        version: 1,
        extension: ".form.md",
      });
    });

    it("parses file with -v99 version", () => {
      const result = parseVersionedPath("form-v99.form.md");
      expect(result).toEqual({
        base: "form",
        version: 99,
        extension: ".form.md",
      });
    });

    it("parses file with _v1 version", () => {
      const result = parseVersionedPath("form_v1.form.md");
      expect(result).toEqual({
        base: "form",
        version: 1,
        extension: ".form.md",
      });
    });

    it("parses file with v1 version (no separator)", () => {
      const result = parseVersionedPath("formv1.form.md");
      expect(result).toEqual({
        base: "form",
        version: 1,
        extension: ".form.md",
      });
    });

    it("parses file with path", () => {
      const result = parseVersionedPath("/path/to/form-v5.form.md");
      expect(result).toEqual({
        base: "/path/to/form",
        version: 5,
        extension: ".form.md",
      });
    });

    it("returns null for non-.form.md file", () => {
      const result = parseVersionedPath("form.md");
      expect(result).toBeNull();
    });
  });

  describe("incrementVersion", () => {
    it("adds -v1 to file without version", () => {
      expect(incrementVersion("form.form.md")).toBe("form-v1.form.md");
    });

    it("increments -v1 to -v2", () => {
      expect(incrementVersion("form-v1.form.md")).toBe("form-v2.form.md");
    });

    it("increments -v99 to -v100", () => {
      expect(incrementVersion("form-v99.form.md")).toBe("form-v100.form.md");
    });

    it("converts _v1 to -v2", () => {
      expect(incrementVersion("form_v1.form.md")).toBe("form-v2.form.md");
    });

    it("handles files with paths", () => {
      expect(incrementVersion("/path/to/form-v5.form.md")).toBe(
        "/path/to/form-v6.form.md"
      );
    });

    it("handles non-.form.md files", () => {
      expect(incrementVersion("file.txt")).toBe("file.txt-v1");
    });
  });

  describe("generateVersionedPath", () => {
    const mockExistsSync = vi.mocked(existsSync);

    it("returns -v1 when no files exist", () => {
      mockExistsSync.mockReturnValue(false);
      expect(generateVersionedPath("form.form.md")).toBe("form-v1.form.md");
    });

    it("returns -v2 when -v1 exists", () => {
      mockExistsSync.mockImplementation((path) => {
        return path === "form-v1.form.md";
      });
      expect(generateVersionedPath("form.form.md")).toBe("form-v2.form.md");
    });

    it("returns -v3 when -v1 and -v2 exist", () => {
      mockExistsSync.mockImplementation((path) => {
        return path === "form-v1.form.md" || path === "form-v2.form.md";
      });
      expect(generateVersionedPath("form.form.md")).toBe("form-v3.form.md");
    });

    it("increments from existing version", () => {
      mockExistsSync.mockImplementation((path) => {
        return path === "form-v6.form.md";
      });
      expect(generateVersionedPath("form-v5.form.md")).toBe("form-v7.form.md");
    });

    it("skips to next available version", () => {
      mockExistsSync.mockImplementation((path) => {
        return (
          path === "form-v6.form.md" ||
          path === "form-v7.form.md" ||
          path === "form-v8.form.md"
        );
      });
      expect(generateVersionedPath("form-v5.form.md")).toBe("form-v9.form.md");
    });

    it("handles non-.form.md files", () => {
      mockExistsSync.mockImplementation((path) => {
        return path === "file.txt-v1";
      });
      expect(generateVersionedPath("file.txt")).toBe("file.txt-v2");
    });
  });
});
