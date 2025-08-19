import type { RequestUrlResponsePromise, requestUrl as ru } from "obsidian";
import { DEFAULT_SETTINGS } from "src/constants";
import { generateKey, upload, type UploadCtx } from "src/upload";
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

const originalRandom = Math.random;

describe("generateKey", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		const date = new Date(2024, 1, 1, 13);
		vi.setSystemTime(date);
		// mock Math.random
		const mockedRandom = vi.fn(() => 0.9);
		Math.random = mockedRandom;
	});

	afterEach(() => {
		vi.useRealTimers();

		Math.random = originalRandom;
	});
	test("should generate a key", async () => {
		const key = await generateKey(
			new ArrayBuffer(0),
			{
				basename: "basename",
				extension: "png",
				name: "basename.png",
				path: "path",
			},
			"{{year}}/{{month}}/{{day}}/{{random6}}/{{base62_of_ms_from_day_start}}-{{random2}}/{{name}}/{{basename}}.{{extension}}",
		);
		expect(key).toEqual("2024/02/01/333333/3amOI-33/basename.png/basename.png");
	});
	test("should generate a key", async () => {
		const key = await generateKey(
			new ArrayBuffer(0),
			{
				basename: "basename",
				extension: "png",
				name: "basename.png",
				path: "path",
			},
			"{{unknown}}",
		);
		expect(key).toEqual("{{unknown}}");
	});
});

describe("upload", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		const date = new Date(2024, 1, 1, 13);
		vi.setSystemTime(date);
	});

	afterEach(() => {
		vi.useRealTimers();
	});
	test("upload", async () => {
		const binary = new Uint32Array([1, 2, 3]).buffer;
		const tFile = {
			basename: "basename",
			extension: "png",
			name: "basename.png",
			path: "basename.png",
		};

		let params = "";
		const requestUrl: typeof ru = (...args) => {
			params = JSON.stringify(args);
			return Promise.resolve({
				status: 200,
			}) as RequestUrlResponsePromise;
		};
		const ctx: UploadCtx = {
			settings: Object.assign(DEFAULT_SETTINGS, {
				s3: {
					bucket: "bucket",
					endpoint: "https://api.example.com",
					keyTemplate:
						"obsidian/{{year}}/{{month}}/{{day}}/{{base62_of_ms_from_day_start}}.{{extension}}",
					forcePathStyle: false,
					publicUrl: "https://example.com/",
					region: "auto",
					accKeyId: "Abc",
					secretAccKey: "Def",
				},
			}),
			requestUrl,
		};

		const url = await upload(binary, tFile, ctx);
		expect(url).toEqual("https://example.com/obsidian/2024/02/01/3amOI.png");
		expect(JSON.parse(params)).toMatchSnapshot();
	});
	test("upload with default mime", async () => {
		const binary = new Uint32Array([1, 2, 3]).buffer;
		const tFile = {
			basename: "basename",
			extension: "kkk",
			name: "basename.kkk",
			path: "basename.kkk",
		};

		let params = "";
		const requestUrl: typeof ru = (args) => {
			params = JSON.stringify(args);
			return Promise.resolve({
				status: 200,
			}) as RequestUrlResponsePromise;
		};
		const ctx: UploadCtx = {
			settings: Object.assign(DEFAULT_SETTINGS, {
				s3: {
					bucket: "bucket",
					endpoint: "https://api.example.com",
					keyTemplate:
						"obsidian/{{year}}/{{month}}/{{day}}/{{base62_of_ms_from_day_start}}.{{extension}}",
					forcePathStyle: false,
					publicUrl: "https://example.com/",
					region: "auto",
					accKeyId: "Abc",
					secretAccKey: "Def",
				},
			}),
			requestUrl,
		};

		const url = await upload(binary, tFile, ctx);
		expect(url).toEqual("https://example.com/obsidian/2024/02/01/3amOI.kkk");
		expect(JSON.parse(params)?.contentType).toEqual("application/octet-stream");
	});

	test("upload fail", async () => {
		const binary = new Uint32Array([1, 2, 3]).buffer;
		const tFile = {
			basename: "basename",
			extension: "png",
			name: "basename.png",
			path: "basename.png",
		};

		const requestUrl: typeof ru = (...args) => {
			return Promise.resolve({
				status: 400,
			}) as RequestUrlResponsePromise;
		};
		const ctx: UploadCtx = {
			settings: Object.assign(DEFAULT_SETTINGS, {
				s3: {
					bucket: "bucket",
					endpoint: "https://api.example.com",
					keyTemplate:
						"obsidian/{{year}}/{{month}}/{{day}}/{{base62_of_ms_from_day_start}}.{{extension}}",
					forcePathStyle: false,
					publicUrl: "https://example.com/",
					region: "auto",
					accKeyId: "Abc",
					secretAccKey: "Def",
				},
			}),
			requestUrl,
		};

		expect(async () => {
			await upload(binary, tFile, ctx);
		}).rejects.toThrowError("400");
	});

	test("upload with spaces in filename", async () => {
		const binary = new Uint32Array([1, 2, 3]).buffer;
		const tFile = {
			basename: "file with spaces",
			extension: "png",
			name: "file with spaces.png",
			path: "folder/file with spaces.png",
		};

		const requestUrl: typeof ru = (...args) => {
			return Promise.resolve({
				status: 200,
			}) as RequestUrlResponsePromise;
		};
		const ctx: UploadCtx = {
			settings: Object.assign(DEFAULT_SETTINGS, {
				s3: {
					bucket: "bucket",
					endpoint: "https://api.example.com",
					keyTemplate: "{{name}}",
					forcePathStyle: false,
					publicUrl: "https://example.com/",
					region: "auto",
					accKeyId: "Abc",
					secretAccKey: "Def",
				},
			}),
			requestUrl,
		};

		const url = await upload(binary, tFile, ctx);
		expect(url).toEqual("https://example.com/file%20with%20spaces.png");
	});
});
