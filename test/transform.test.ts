import { transform, type TransformCtx } from "src/transform";
import { DEFAULT_SETTINGS } from "src/constants";
import { describe, test, expect, vi, afterEach } from "vitest";
import type { Loc, Pos, TFile } from "obsidian";
import type { PTFile } from "src/main";

describe("transform", () => {
	afterEach(() => {
		vi.resetAllMocks();
	});
	test("should transform links and embeds", async () => {
		const input = "[[file.png]]\n![[file.png]]";
		const resolve: Record<string, PTFile> = {
			"file.png": {
				basename: "file",
				extension: "png",
				name: "file.png",
				path: "file.png",
			},
		};
		expect(
			await transform(makeCtx(resolve), input, {
				selfPath: "input.md",
				links: [
					{
						position: makePos(0, 12),
						link: "file.png",
						original: "[[file.png]]",
					},
				],
				embeds: [
					{
						position: makePos(13, 26),
						link: "file.png",
						original: "![[file.png]]",
					},
				],
			}),
		).toEqual([
			"[file.png](https://example.com/file.png)\n![file.png](https://example.com/file.png)",
			["file.png"],
		]);
	});
	test("should transform with alt", async () => {
		const input = "![[file.png|alt text]]";
		const resolve: Record<string, PTFile> = {
			"file.png": {
				basename: "file",
				extension: "png",
				name: "file.png",
				path: "file.png",
			},
		};
		const output = await transform(makeCtx(resolve), input, {
			selfPath: "input.md",
			embeds: [
				{
					position: makePos(0, 22),
					link: "file.png",
					original: "![[file.png|alt text]]",
					displayText: "alt text",
				},
			],
			links: [],
		});
		expect(output).toEqual([
			"![alt text](https://example.com/file.png)",
			["file.png"],
		]);
	});
	test("fail to upload", async () => {
		const input = "![[file.png|alt text]]";
		const resolve: Record<string, PTFile> = {
			"file.png": {
				basename: "file",
				extension: "png",
				name: "file.png",
				path: "file.png",
			},
		};
		const ctx = {
			...makeCtx(resolve),
			uploader: () => {
				throw new Error("Test Message");
			},
		};
		const spy = vi.spyOn(ctx, "notice");

		const output = await transform(ctx, input, {
			selfPath: "input.md",
			embeds: [
				{
					position: makePos(0, 22),
					link: "file.png",
					original: "![[file.png|alt text]]",
					displayText: "alt text",
				},
			],
			links: [],
		});
		expect(output).toEqual(["![[file.png|alt text]]", []]);
		expect(spy).toHaveBeenLastCalledWith("Failed to upload file: file.png");
	});
	test("fail to resolve", async () => {
		const input = "![[file.png|alt text]]";
		const ctx = makeCtx({});
		const spy = vi.spyOn(ctx, "notice");

		const output = await transform(ctx, input, {
			selfPath: "input.md",
			embeds: [
				{
					position: makePos(0, 22),
					link: "file.png",
					original: "![[file.png|alt text]]",
					displayText: "alt text",
				},
			],
			links: [],
		});
		expect(output).toEqual(["![[file.png|alt text]]", []]);
		expect(spy).toHaveBeenLastCalledWith(
			`File "![[file.png|alt text]]" not found in vault.`,
		);
	});
	test("ext not in settings", async () => {
		const input = "![[file.png|alt text]]";
		const resolve: Record<string, PTFile> = {
			"file.png": {
				basename: "file",
				extension: "png",
				name: "file.png",
				path: "file.png",
			},
		};
		const ctx = {
			...makeCtx(resolve),
			settings: Object.assign(DEFAULT_SETTINGS, { uploadExt: "" }),
		};
		const spy = vi.spyOn(ctx, "notice");

		const output = await transform(ctx, input, {
			selfPath: "input.md",
			embeds: [
				{
					position: makePos(0, 22),
					link: "file.png",
					original: "![[file.png|alt text]]",
					displayText: "alt text",
				},
			],
			links: [],
		});
		expect(output).toEqual(["![[file.png|alt text]]", []]);
		expect(
			spy,
		).toHaveBeenLastCalledWith(`File "file" won't be uploaded for having extension "png".
Go to settings to configure that.`);
	});
});

function notice(text: string) {
	console.log(`[Notice] ${text}`);
}

function makeCtx(resolve: Record<string, PTFile>): TransformCtx {
	return {
		settings: DEFAULT_SETTINGS,
		uploader: async (_, file) => `https://example.com/${file.path}`,
		resolveLink: (link, selfPath) => resolve[link] as TFile,
		readBinary: async () => new ArrayBuffer(0),
		notice,
	};
}

function makePos(s: number, e: number): Pos {
	return {
		start: {
			offset: s,
		} as Loc,
		end: {
			offset: e,
		} as Loc,
	};
}
