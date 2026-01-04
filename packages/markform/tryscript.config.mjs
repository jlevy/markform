import { defineConfig } from 'tryscript';

export default defineConfig({
  // Global config - individual test files can override
  env: {
    NO_COLOR: '1',
    FORCE_COLOR: '0',
  },
  timeout: 30000,
  patterns: {
    VERSION: '\\d+\\.\\d+\\.\\d+(?:-[a-z]+\\.\\d+)?',
    PATH: '/[^\\s]+',
  },
});
