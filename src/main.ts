import { Notice, Plugin, requestUrl, type TFile } from "obsidian";
import { DEFAULT_SETTINGS, SettingsTab, type Settings } from "./settings";
import { getDeletingFiles, transform } from "./transform";
import { upload } from "./upload";
import { createPromiseWithResolver, DeleteConfirmModal } from "./confirm-modal";

declare global {
	var cJS: () => Promise<unknown>;
}

export type PTFile = Pick<TFile, "basename" | "extension" | "name" | "path">;

export default class ImageUploadPlugin extends Plugin {
	settings: Settings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		this.addRibbonIcon("image-up", "Upload images for active file", () =>
			this.process(),
		);
		this.addCommand({
			id: "upload-image-for-active-file",
			name: "Upload images for active file",
			callback: () => this.process(),
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SettingsTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async process() {
		const file = this.app.workspace.getActiveFile();
		if (!file) {
			new Notice("No active file");
			return;
		}
		const uploadedFiles = await this.uploadAndReplace(file);

		if (!uploadedFiles) {
			return;
		}

		new Notice(`Uploaded and replaced ${uploadedFiles.length} links`);

		if (!uploadedFiles.length) {
			return;
		}

		await this.deleteUploadedFiles(uploadedFiles, file);
	}

	async uploadAndReplace(file: TFile) {
		const cachedMetadata = this.app.metadataCache.getFileCache(file);
		if (!cachedMetadata) {
			new Notice("No assets in cache");
			return;
		}

		const { links, embeds } = cachedMetadata;

		if (!(links?.length || embeds?.length)) {
			new Notice("Nothing to upload");
			return;
		}

		const uploadedFiles = await asyncProcess(async (content: string) => {
			return transform(
				{
					settings: this.settings,
					uploader: await this.getUploader(),
					readBinary: (...args) => this.app.vault.readBinary(...args),
					resolveLink: (...args) =>
						this.app.metadataCache.getFirstLinkpathDest(...args),
					notice: (...args) => new Notice(...args),
				},
				content,
				{
					selfPath: file.path,
					links: links ?? [],
					embeds: embeds ?? [],
				},
			);
		}, file);

		return uploadedFiles;
	}
	async deleteUploadedFiles(uploadedFiles: string[], file: TFile) {
		const filesToDelete = getDeletingFiles(
			uploadedFiles,
			this.app.metadataCache.resolvedLinks,
			file.path,
		);

		console.log("Files to delete", filesToDelete);
		const { promise: confirmPromise, handler } = createPromiseWithResolver();
		new DeleteConfirmModal(this.app, handler, filesToDelete).open();
		try {
			await confirmPromise;
		} catch {
			new Notice("Deletion aborted");
			return;
		}

		for (const filePath of filesToDelete) {
			const file = this.app.vault.getFileByPath(filePath);
			if (!file) {
				console.warn("File not found", filePath);
				continue;
			}
			await this.app.vault.trash(file, this.settings.useSystemTrash);
		}
	}

	async getUploader(): Promise<
		(binary: ArrayBuffer, file: PTFile) => Promise<string>
	> {
		const { settings } = this;
		const className = settings.customUploaderClass;

		// If no class is provided, use the default S3 uploader
		if (!className) {
			return async (binary, file) => {
				return upload(binary, file, {
					settings,
					requestUrl: (...args) => requestUrl(...args),
				});
			};
		}
		let cJsObj: unknown;
		try {
			cJsObj = await cJS();
		} catch (e) {
			new Notice("Failed to load Custom JS");
			throw e;
		}

		if (!(cJsObj && typeof cJsObj === "object" && className in cJsObj)) {
			new Notice(`Class "${className}" not found in custom JS`);
			throw new Error(`Class "${className}" not found in custom JS`);
		}
		const uploaderClass = (cJsObj as Record<string, unknown>)[className];

		if (
			!(
				uploaderClass &&
				typeof uploaderClass === "object" &&
				"upload" in uploaderClass &&
				typeof uploaderClass.upload === "function"
			)
		) {
			new Notice(`Method "upload" not found in class "${className}"`);
			throw new Error(`Method "upload" not found in class "${className}`);
		}

		return async (binary, file) => {
			const result = await (
				uploaderClass as {
					upload: (binary: ArrayBuffer, file: PTFile) => Promise<unknown>;
				}
			).upload(binary, file);
			if (typeof result !== "string") {
				throw new Error("Result is not a string");
			}
			return result;
		};
	}
}

async function asyncProcess<T>(
	action: (content: string) => Promise<[string, T]>,
	file: TFile,
): Promise<T> {
	new Notice("Processing file. DO NOT MODIFY THE FILE UNTIL DONE");
	const content = await file.vault.cachedRead(file);
	const [newContent, other] = await action(content);
	await file.vault.process(file, (data) => {
		if (data !== content) {
			new Notice(
				"File has been updated during processing. User modified content will be concatenated to the end of the file",
			);
			return `${newContent}\n\`\`\`\n<!--Modified version while processing-->\n${data}\n\`\`\`\n`;
		}
		return newContent;
	});
	return other;
}
