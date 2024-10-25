# Obsidian Image Uploader (for one note)

[![Tests](https://github.com/yy4382/obsidian-image-upload/actions/workflows/test.yml/badge.svg)](https://github.com/yy4382/obsidian-image-upload/actions/workflows/test.yml)

A simple plugin that uploads local images in a note to S3 (and S3 compatible services), replace the image link with the S3 link, and if the image is only used in this note, the image will be deleted from the vault (optional).

Or, instead of S3, you can write a custom function to upload the image via [Custom JS plugin](https://github.com/saml-dev/obsidian-custom-js).

## Usage

### Use S3 uploader

1. Fill in the S3 configuration in the settings.
2. Leave the `Custom Uploader Class` option empty.

### Use custom uploader

You need to install the [Custom JS plugin](https://github.com/saml-dev/obsidian-custom-js) first.

Add a class to your custom js file, which need to have a function named `upload`, with the following signature:

```typescript
async function upload(
	binary: ArrayBuffer,
	tFile: Pick<TFile, "basename" | "extension" | "name" | "path">
): Promise<string>;
```

And then set the `Custom Uploader Class` option in the settings to the class name.

For example, if you have a class named `CustomUploader` in your custom js file:

```javascript
class CustomUploader {
	async upload(
		binary /* ArrayBuffer */,
		file /* Pick<TFile, "basename" | "extension" | "name" | "path"> */
	) {
		console.log(file.name, file.path);
		// https://docs.obsidian.md/Reference/TypeScript+API/requestUrl
		await requestUrl({
			url: `https://api.example.com/upload?path=${encodeURIComponent(
				file.path
			)}`,
			method: "POST",
			body: binary,
		});
		return `https://example.com/${file.path}`;
	}
}
```

Then set the `Custom Uploader Class` option in the settings to `CustomUploader`.
