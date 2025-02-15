import { defineConfig } from '@vscode/test-cli';
import path from 'path';

export default defineConfig({
	files: 'out/test/**/*.test.js',
  workspaceFolder: path.resolve("src", "test", "test-workspace"),
  env: {
    TEST_MODE: true,
  },
  mocha: {
    timeout: 60000,
  },
});
