import type { Settings } from "./settings";

export const DEFAULT_SETTINGS: Settings = {
	s3: {
		endpoint: "",
		accKeyId: "",
		secretAccKey: "",
		bucket: "",
		keyTemplate:
			"obsidian/{{year}}/{{month}}/{{day}}/{{base62_of_ms_from_day_start}}-{{random2}}.{{extension}}",
		region: "",
		forcePathStyle: false,
		publicUrl: "",
	},
	customUploaderClass: "",
	uploadExt: "png jpg jpeg gif webp",
	useSystemTrash: false,
};
