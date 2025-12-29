import { defineConfig } from 'tsdown';

import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli/cli.ts',
    bin: 'src/cli/bin.ts',
    'ai-sdk': 'src/integrations/vercelAiSdkTools.ts',
  },
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  sourcemap: false,
  dts: true,
  clean: true,
  banner: ({ fileName }) => (fileName.includes('bin') ? '#!/usr/bin/env node\n' : ''),
  define: {
    __MARKFORM_VERSION__: JSON.stringify(pkg.version),
  },
});
