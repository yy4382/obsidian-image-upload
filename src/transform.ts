import type {
	EmbedCache,
	LinkCache,
	Pos,
	App,
	ReferenceCache,
	Notice,
	Vault,
	MetadataCache,
} from "obsidian";
import type { Settings } from "./settings";
import type { PTFile } from "./main";

export type TransformCtx = {
	settings: Settings;
	uploader: (binary: ArrayBuffer, tFile: PTFile) => Promise<string>;
	resolveLink: MetadataCache["getFirstLinkpathDest"];
	readBinary: Vault["readBinary"];
	notice: (...args: ConstructorParameters<typeof Notice>) => void;
};

export async function transform(
	ctx: TransformCtx,
	content: string,
	meta: {
		selfPath: string;
		links: LinkCache[];
		embeds: EmbedCache[];
	},
): Promise<[string, string[]]> {
	const process = async (link: ReferenceCache, isEmbed: boolean) => {
		const targetFile = ctx.resolveLink(link.link.split("#")[0], meta.selfPath);
		if (!targetFile) {
			ctx.notice(`File "${link.original}" not found in vault.`);
			return;
		}
		if (!ctx.settings.uploadExt.split(" ").includes(targetFile.extension)) {
			ctx.notice(
				`File "${targetFile.basename}" won't be uploaded for having extension "${targetFile.extension}".
Go to settings to configure that.`,
			);
			return;
		}
		const content = await ctx.readBinary(targetFile);
		let url: string;
		try {
			url = await ctx.uploader(content, targetFile);
		} catch (e) {
			console.error(e);
			ctx.notice(`Failed to upload file: ${targetFile.path}`);
			return;
		}
		const newLink = `${isEmbed ? "!" : ""}[${link.displayText ?? link.link}](${url})`;
		return [link.position, newLink, targetFile.path] as [Pos, string, string];
	};

	const actions = (
		await Promise.all([
			...meta.links.map((link) => process(link, false)),
			...meta.embeds.map((embed) => process(embed, true)),
		])
	).filter((x) => x !== undefined);

	const newContent = replace(content, actions);
	const uploadedPaths = dedupe(actions.map(([, , path]) => path));
	return [newContent, uploadedPaths];
}

function dedupe<T>(arr: T[]): T[] {
	return [...new Set(arr)];
}

function replace(
	content: string,
	replaceList: [Pos, string, unknown][],
): string {
	replaceList.sort((a, b) => b[0].start.offset - a[0].start.offset);
	return replaceList.reduce((acc, [pos, str]) => {
		return acc.slice(0, pos.start.offset) + str + acc.slice(pos.end.offset);
	}, content);
}

export function getDeletingFiles(
	uploadedPaths: string[],
	resolvedLinks: App["metadataCache"]["resolvedLinks"],
	sourcePath: string,
): string[] {
	const deletingFiles = new Set<string>();
	for (const path of uploadedPaths) {
		let found = false;
		for (const source in resolvedLinks) {
			if (source === sourcePath) continue;
			if (Object.keys(resolvedLinks[source]).includes(path)) {
				found = true;
				break;
			}
		}
		if (!found) deletingFiles.add(path);
	}
	return [...deletingFiles];
}
