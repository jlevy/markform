import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli/cli.ts",
    bin: "src/cli/bin.ts",
  },
  format: ["esm", "cjs"],
  platform: "node",
  target: "node24",
  sourcemap: true,
  dts: true,
  clean: true,
  banner: ({ fileName }) =>
    fileName.includes("bin") ? "#!/usr/bin/env node\n" : "",
});
