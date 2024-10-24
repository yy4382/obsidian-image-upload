import {
	type Editor,
	type MarkdownView,
	Notice,
	Plugin,
	type TFile,
} from "obsidian";
import { DEFAULT_SETTINGS, SettingsTab, type Settings } from "./settings";
import { getDeletingFiles, transform, type TransformCtx } from "./transform";
import { upload } from "./upload";

export default class ImageUploadPlugin extends Plugin {
	settings: Settings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		this.addRibbonIcon("dice", "Upload images for active file", () =>
			this.process(),
		);

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: "sample-editor-command",
			name: "Sample editor command",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection("Sample Editor Command");
			},
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
		const cachedMetadata = this.app.metadataCache.getFileCache(file);

		if (
			!(
				cachedMetadata?.links &&
				cachedMetadata.embeds &&
				cachedMetadata.links.length &&
				cachedMetadata.embeds.length
			)
		) {
			new Notice("Nothing to upload");
			return;
		}

		const uploadedFiles = await asyncProcess((content: string) => {
			return transform(
				{
					settings: this.settings,
					uploader: upload,
					readBinary: (...args: Parameters<TransformCtx["readBinary"]>) =>
						this.app.vault.readBinary(...args),
					resolveLink: (...args: Parameters<TransformCtx["resolveLink"]>) =>
						this.app.metadataCache.getFirstLinkpathDest(...args),
					notice: (...args) => new Notice(...args),
				},
				content,
				{
					selfPath: file.path,
					// biome-ignore lint/style/noNonNullAssertion: has early return if links/embeds are empty
					links: cachedMetadata.links!,
					// biome-ignore lint/style/noNonNullAssertion: has early return if links/embeds are empty
					embeds: cachedMetadata.embeds!,
				},
			);
		}, file);

		const filesToDelete = getDeletingFiles(
			uploadedFiles,
			this.app.metadataCache.resolvedLinks,
			file.path,
		);
		console.log("Files to delete", filesToDelete);
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
	new Notice("Processing file, DO NOT MODIFY THE FILE UNTIL DONE");
	const content = await file.vault.cachedRead(file);
	const [newContent, other] = await action(content);
	await file.vault.process(file, (data) => {
		if (data !== content) {
			new Notice(
				"File has been updated during processing, and will be overwritten. Open dev tools to see the old one",
			);
			console.warn("Content modified during processing\n", {
				original: content,
				new: newContent,
				overwritten: data,
			});
		}
		return newContent;
	});
	return other;
}
