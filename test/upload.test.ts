import { generateKey } from "src/upload";
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
});
