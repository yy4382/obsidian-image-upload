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

		new Setting(containerEl).setHeading().setName("S3 Settings");
		this.addTextSetting(
			"Endpoint",
			"Endpoint of the S3 service",
			() => this.plugin.settings.s3.endpoint,
			(value) => {
				this.plugin.settings.s3.endpoint = value;
			},
		);
		this.addTextSetting(
			"Access Key ID",
			"Access Key ID for the S3 service",
			() => this.plugin.settings.s3.accKeyId,
			(value) => {
				this.plugin.settings.s3.accKeyId = value;
			},
		);
		this.addTextSetting(
			"Secret Access Key",
			"Secret Access Key for the S3 service",
			() => this.plugin.settings.s3.secretAccKey,
			(value) => {
				this.plugin.settings.s3.secretAccKey = value;
			},
		);
		this.addTextSetting(
			"Bucket",
			"Bucket to upload to",
			() => this.plugin.settings.s3.bucket,
			(value) => {
				this.plugin.settings.s3.bucket = value;
			},
		);
		this.addTextSetting(
			"Key Template",
			"Template for the key to use in S3",
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
			"Public URL of the S3 service",
			() => this.plugin.settings.s3.publicUrl ?? "",
			(value) => {
				this.plugin.settings.s3.publicUrl = value;
			},
		);
		new Setting(containerEl)
			.setName("Force Path Style")
			.setDesc("Whether to use path-style addressing")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.s3.forcePathStyle)
					.onChange(async (value) => {
						this.plugin.settings.s3.forcePathStyle = value;
						await this.plugin.saveSettings();
					});
			});
		new Setting(containerEl).setHeading().setName("General Settings");
		new Setting(containerEl)
			.setName("Upload Extensions")
			.setDesc("Extensions to upload")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.uploadExt)
					.onChange(async (value) => {
						this.plugin.settings.uploadExt = value;
						await this.plugin.saveSettings();
					}),
			);
		new Setting(containerEl).setName("Use System Trash").addToggle((toggle) => {
			toggle
				.setValue(this.plugin.settings.useSystemTrash)
				.onChange(async (value) => {
					this.plugin.settings.useSystemTrash = value;
					await this.plugin.saveSettings();
				});
		});
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
