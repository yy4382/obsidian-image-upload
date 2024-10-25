import { Notice, Plugin, requestUrl, type TFile } from "obsidian";
import { DEFAULT_SETTINGS, SettingsTab, type Settings } from "./settings";
import { getDeletingFiles, transform } from "./transform";
import { upload } from "./upload";
import { createPromiseWithResolver, DeleteConfirmModal } from "./confirm-modal";

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

		const uploadedFiles = await asyncProcess((content: string) => {
			return transform(
				{
					settings: this.settings,
					uploader: (binary, file) =>
						upload(binary, file, {
							settings: this.settings,
							requestUrl: (...args) => requestUrl(...args),
						}),
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
