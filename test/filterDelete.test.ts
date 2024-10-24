import { getDeletingFiles } from "src/transform";
import { describe, test, expect } from "vitest";

describe("getDeletingFiles", () => {
	test("normal", () => {
		const resolvedLinks = {
			"Welcome.md": {},
			"Test Post.md": {
				"Image1.png": 1,
				"Image2.png": 1,
			},
		};
		const uploadedPaths = ["Image1.png", "Image2.png"];
		const sourcePath = "Test Post.md";
		expect(getDeletingFiles(uploadedPaths, resolvedLinks, sourcePath)).toEqual([
			"Image1.png",
			"Image2.png",
		]);
	});
	test("also used by other", () => {
		const resolvedLinks = {
			"Welcome.md": {
				"Image1.png": 1,
			},
			"Test Post.md": {
				"Image1.png": 1,
				"Image2.png": 1,
			},
		};
		const uploadedPaths = ["Image1.png", "Image2.png"];
		const sourcePath = "Test Post.md";
		expect(getDeletingFiles(uploadedPaths, resolvedLinks, sourcePath)).toEqual([
			"Image2.png",
		]);
	});
});
