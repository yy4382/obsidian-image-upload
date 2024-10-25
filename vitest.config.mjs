import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	plugins: [tsconfigPaths()],
	build: {
		rollupOptions: {
			external: ["obsidian"],
		},
	},
	test: {
		globalSetup: "./test/global-setup.ts",
		coverage: {
			include: ["src/transform.ts", "upload.ts"],
		},
	},
});
