import { type App, PluginSettingTab, Setting } from "obsidian";
import type ImageUploadPlugin from "./main";

export type Settings = {
	s3: {
		endpoint: string;
		accKeyId: string;
		secretAccKey: string;
		bucket: string;
		keyTemplate: string;
		region: string;
		forcePathStyle: boolean;
		publicUrl: string;
	};
	customUploaderClass: string;
	uploadExt: string;
	useSystemTrash: boolean;
};

export { DEFAULT_SETTINGS } from "./constants";

export class SettingsTab extends PluginSettingTab {
	plugin: ImageUploadPlugin;

	constructor(app: App, plugin: ImageUploadPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl).setHeading().setName("S3 settings");
		this.addTextSetting(
			"Endpoint",
			"Endpoint of the S3 service",
			() => this.plugin.settings.s3.endpoint,
			(value) => {
				this.plugin.settings.s3.endpoint = value;
			},
		);
		this.addTextSetting(
			"Access key ID",
			"Access key ID for the S3 service",
			() => this.plugin.settings.s3.accKeyId,
			(value) => {
				this.plugin.settings.s3.accKeyId = value;
			},
		);
		this.addTextSetting(
			"Secret access ey",
			"Secret access key for the S3 service",
			() => this.plugin.settings.s3.secretAccKey,
			(value) => {
				this.plugin.settings.s3.secretAccKey = value;
			},
		);
		this.addTextSetting(
			"Bucket name",
			"Bucket to upload to",
			() => this.plugin.settings.s3.bucket,
			(value) => {
				this.plugin.settings.s3.bucket = value;
			},
		);
		this.addTextSetting(
			"Key template",
			"Template for the key(path) to use in S3. Template in {{}} will be replaced.\nAvailable variables: year, month, day, random2, random6, base62_of_ms_from_day_start, path, name, basename, extension",
			() => this.plugin.settings.s3.keyTemplate,
			(value) => {
				this.plugin.settings.s3.keyTemplate = value;
			},
		);
		this.addTextSetting(
			"Region",
			"Region of the S3 service",
			() => this.plugin.settings.s3.region,
			(value) => {
				this.plugin.settings.s3.region = value;
			},
		);
		this.addTextSetting(
			"Public URL",
			"URL prefix to access the uploaded files",
			() => this.plugin.settings.s3.publicUrl ?? "",
			(value) => {
				this.plugin.settings.s3.publicUrl = value;
			},
		);

		containerEl.createEl("p", {
			text: "For example, if the public URL is 'https://example.com' and the key template is '{{path}}', the uploaded file (has path 'path/to/file.jpg') will be accessible at 'https://example.com/path/to/file.jpg'",
			cls: "setting-item-description",
		});

		new Setting(containerEl)
			.setName("Force path style")
			.setDesc("Whether to use path-style addressing")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.s3.forcePathStyle)
					.onChange(async (value) => {
						this.plugin.settings.s3.forcePathStyle = value;
						await this.plugin.saveSettings();
					});
			});
		new Setting(containerEl).setHeading().setName("General settings");
		new Setting(containerEl)
			.setName("Upload extensions")
			.setDesc("File extensions to upload")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.uploadExt)
					.onChange(async (value) => {
						this.plugin.settings.uploadExt = value;
						await this.plugin.saveSettings();
					}),
			);
		new Setting(containerEl)
			.setName("Use system trash")
			.setDesc('Use system trash or Obsidian ".trash" folder')
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.useSystemTrash)
					.onChange(async (value) => {
						this.plugin.settings.useSystemTrash = value;
						await this.plugin.saveSettings();
					});
			});
		new Setting(containerEl)
			.setName("Custom uploader class")
			.setDesc(
				"Class(defined in CustomJS) to use for custom uploader, leave empty to use default S3",
			)
			.addText((text) =>
				text
					.setValue(this.plugin.settings.customUploaderClass)
					.onChange(async (value) => {
						this.plugin.settings.customUploaderClass = value;
						await this.plugin.saveSettings();
					}),
			);
	}
	addTextSetting(
		name: string,
		desc: string,
		get: () => string,
		set: (value: string) => void,
	): void {
		new Setting(this.containerEl)
			.setName(name)
			.setDesc(desc)
			.addText((text) =>
				text.setValue(get()).onChange(async (value) => {
					set(value);
					await this.plugin.saveSettings();
				}),
			);
	}
}
