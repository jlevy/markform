import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli/cli.ts',
    bin: 'src/cli/bin.ts',
    'ai-sdk': 'src/integrations/ai-sdk.ts',
  },
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  sourcemap: false,
  dts: true,
  clean: true,
  banner: ({ fileName }) => (fileName.includes('bin') ? '#!/usr/bin/env node\n' : ''),
});
