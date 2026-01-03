import { defineConfig } from 'tryscript';

export default defineConfig({
  bin: './dist/cli.cjs',
  env: {
    NO_COLOR: '1',
    FORCE_COLOR: '0',
  },
  timeout: 30000,
  patterns: {
    VERSION: '\\d+\\.\\d+\\.\\d+(?:-[a-z]+\\.\\d+)?',
    PATH: '/[^\\s]+',
    HASH: '[a-f0-9]{64}',
    DATE: '\\d{4}-\\d{2}-\\d{2}',
    TIME: '\\d+(?:\\.\\d+)?(?:ms|s)',
  },
});
