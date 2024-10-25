import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { requestUrl, TFile } from "obsidian";
import type { Settings } from "./settings";
import mime from "mime";
import { encode as encode62 } from "base62";
import type { PTFile } from "./main";

export type UploadCtx = {
	settings: Settings;
	requestUrl: typeof requestUrl;
};

export async function upload(
	binary: ArrayBuffer,
	tFile: PTFile,
	ctx: UploadCtx,
): Promise<string> {
	const key = await generateKey(binary, tFile, ctx.settings.s3.keyTemplate);
	await s3Upload(binary, key, tFile.extension, ctx);
	return ctx.settings.s3.publicUrl + key;
}

type TemplateParams =
	| "year"
	| "month"
	| "day"
	| "random2"
	| "random6"
	| "base62_of_ms_from_day_start"
	| "path"
	| "name"
	| "basename"
	| "extension";

export async function generateKey(
	binary: ArrayBuffer,
	tFile: PTFile,
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
		path: tFile.path,
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
		// use Math.random is OK here, as it's not for security purpose
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

async function s3Upload(
	file: ArrayBuffer | string,
	key: string,
	ext: string,
	ctx: UploadCtx,
) {
	const config = ctx.settings.s3;
	const client = new S3Client({
		region: config.region,
		forcePathStyle: config.forcePathStyle,
		credentials: {
			accessKeyId: config.accKeyId,
			secretAccessKey: config.secretAccKey,
		},
		endpoint: config.endpoint,
	});

	const command = new PutObjectCommand({
		Bucket: config.bucket,
		Key: key,
	});

	const url = await getSignedUrl(client, command);

	const resp = await ctx.requestUrl({
		url,
		method: "PUT",
		body: file,
		contentType: mime.getType(ext) || "application/octet-stream",
		throw: false,
	});

	if (resp.status !== 200) {
		throw new Error(`Failed to upload file: ${resp.status}`);
	}
}
