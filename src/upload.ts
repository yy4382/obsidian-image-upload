import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { requestUrl, TFile } from "obsidian";
import type { Settings } from "./settings";
import mime from "mime";
import { encode as encode62 } from "base62";

export type UploadCtx = {
	settings: Settings;
	requestUrl: typeof requestUrl;
};

export async function upload(
	binary: ArrayBuffer,
	tFile: Pick<TFile, "basename" | "extension" | "name" | "path">,
	ctx: UploadCtx,
): Promise<string> {
	const key = await generateKey(binary, tFile, ctx.settings.s3.keyTemplate);
	const client = new ImageS3Client(ctx.settings.s3);
	await client.upload(binary, key, ctx.requestUrl);
	return ctx.settings.s3.publicUrl + key;
}

type TemplateParams =
	| "year"
	| "month"
	| "day"
	| "random2"
	| "random6"
	| "base62_of_ms_from_day_start"
	| "name"
	| "basename"
	| "extension";

export async function generateKey(
	binary: ArrayBuffer,
	tFile: Pick<TFile, "basename" | "extension" | "name" | "path">,
	keyTemplate: string,
): Promise<string> {
	const params: Record<TemplateParams, string> = {
		year: new Date().getFullYear().toString(),
		month: (new Date().getMonth() + 1).toString().padStart(2, "0"),
		day: new Date().getDate().toString().padStart(2, "0"),
		random2: randomStringGenerator(2),
		random6: randomStringGenerator(6),
		base62_of_ms_from_day_start: encode62(
			Date.now() - new Date().setHours(0, 0, 0, 0),
		),
		name: tFile.name,
		basename: tFile.basename,
		extension: tFile.extension,
	};

	return template(keyTemplate, params);
}

function template(str: string, params: Record<string, string>): string {
	return str.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
		return params[key] || match;
	});
}

function randomStringGenerator(length: number) {
	const chars =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	let result = "";
	for (let i = 0; i < length; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

// adapted from https://github.com/yy4382/s3-image-port/blob/21f6412991e13d567c5c06f258ed69b726b5b6b4/app/utils/ImageS3Client.ts
class ImageS3Client {
	client: S3Client;
	bucket: string;
	config: Settings["s3"];

	constructor(s3Settings: Settings["s3"]) {
		this.config = s3Settings;
		this.client = new S3Client({
			region: s3Settings.region,
			forcePathStyle: s3Settings.forcePathStyle,
			credentials: {
				accessKeyId: s3Settings.accKeyId,
				secretAccessKey: s3Settings.secretAccKey,
			},
			endpoint: s3Settings.endpoint,
		});
		this.bucket = s3Settings.bucket;
	}

	/**
	 *
	 * @param file The (processed) file to upload
	 * @param key The key to use in S3
	 * @returns The response from the S3 upload operation
	 */
	async upload(
		file: ArrayBuffer | string,
		key: string,
		requestUrlFn: typeof requestUrl,
	) {
		const mimeType = ImageS3Client.calculateMIME(key);

		const command = new PutObjectCommand({
			Bucket: this.bucket,
			Key: key,
		});

		const url = await getSignedUrl(this.client, command);
		console.log("Uploading to", url);

		const resp = await requestUrlFn({
			url,
			method: "PUT",
			body: file,
			headers: {
				"content-type": mimeType,
			},
			throw: false,
		});

		console.log("Upload response", resp);
		if (resp.status !== 200) {
			throw new Error(`Failed to upload file: ${resp.status}`);
		}
	}
	static calculateMIME(key: string) {
		const defaultMIME = "application/octet-stream";
		const keyExt = key.split(".").pop();

		if (keyExt) {
			return mime.getType(keyExt) || defaultMIME;
		}
		return defaultMIME;
	}
}
