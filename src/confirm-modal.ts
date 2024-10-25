export type PromiseHandler = ReturnType<
	typeof createPromiseWithResolver
>["handler"];
import { Modal, Setting, type App } from "obsidian";

export function createPromiseWithResolver() {
	let resolvePromise: (value: unknown) => void;
	let rejectPromise: (reason: unknown) => void;

	const promise = new Promise((resolve, reject) => {
		resolvePromise = resolve;
		rejectPromise = reject;
	});

	const resolver = (value: unknown) => {
		resolvePromise(value);
	};

	const rejecter = (reason: unknown) => {
		rejectPromise(reason);
	};

	return { promise, handler: { resolver, rejecter } };
}

export class ConfirmModal extends Modal {
	private handler: PromiseHandler;
	private needReject: boolean;
	constructor(app: App, handler: PromiseHandler) {
		super(app);
		this.handler = handler;
		this.needReject = true;
	}

	confirm(value?: unknown): void {
		this.handler.resolver(value);
		this.close();
	}
	cancel(reason?: Error): void {
		if (this.needReject) {
			this.handler.rejecter(reason ?? new Error("User aborted"));
		}
		this.needReject = false;
	}
}

export class DeleteConfirmModal extends ConfirmModal {
	files: string[];
	constructor(app: App, handler: PromiseHandler, file: string[]) {
		super(app, handler);
		this.files = file;
	}
	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("h2", {
			text: "Are you sure you want to delete these files?",
		});
		const ul = contentEl.createEl("ul");
		for (const file of this.files) {
			ul.createEl("li", { text: file });
		}

		new Setting(contentEl).addButton((button) => {
			button.setButtonText("Confirm").onClick(() => {
				this.confirm();
			});
		});
	}
	onClose(): void {
		this.cancel();
	}
}
