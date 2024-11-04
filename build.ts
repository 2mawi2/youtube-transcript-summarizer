import * as esbuild from "esbuild";
import { denoPlugins } from "@luca/esbuild-deno-loader";
import sveltePlugin from "esbuild-svelte";
import { parseArgs } from "@std/cli";

const loggerPlugin: esbuild.Plugin = {
  name: "watch-logger",
  setup(build) {
    let startTime = Date.now();
    build.onStart(() => {
      startTime = Date.now();
      console.log("%cBuilding...", "color: cyan");
    });
    build.onEnd(() => {
      const timeMs = Date.now() - startTime;
      console.log(`%cBuild completed in ${timeMs}ms`, "color: cyan");
    });
  },
};

const buildOptions: esbuild.BuildOptions = {
  plugins: [
    loggerPlugin,
    // @ts-ignore -- Invalid typings
    sveltePlugin(),
    ...denoPlugins(),
  ],
  entryPoints: ["./src/content.ts", "./src/background.ts"],
  outdir: "dist",
  bundle: true,
  sourcemap: true,
  format: "esm",
};

const args = parseArgs(Deno.args, {
  boolean: ["watch"],
  default: { watch: false },
});

async function runBuild() {
  await esbuild.build(buildOptions);
}

if (args.watch) {
  console.log("%cWatching for changes...", "color: grey");
  const context = await esbuild.context(buildOptions);
  await context.watch();
  console.log("%cWatch mode started. Press Ctrl+C to stop.", "color: grey");
} else {
  await runBuild();
}
