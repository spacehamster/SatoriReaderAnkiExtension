import react from '@vitejs/plugin-react';
import { resolve, join } from 'path';
import fs from 'fs';
import { defineConfig } from 'vite';
import { crx, ManifestV3Export } from '@crxjs/vite-plugin';
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url));

import manifest from './manifest.json';
import devManifest from './manifest.dev.json';
import pkg from './package.json';

const root = resolve(__dirname, 'src');
const pagesDir = resolve(root, 'pages');
const scriptsDir = resolve(root, 'scripts');
const assetsDir = resolve(root, 'assets');
const outDir = resolve(__dirname, 'dist');
const publicDir = resolve(__dirname, 'public');

// plugin to remove dev icons from prod build
function stripDevIcons(isDev: boolean) {
  if (isDev) return null

  return {
    name: 'strip-dev-icons',
    resolveId(source: string) {
      return source === 'virtual-module' ? source : null
    },
    renderStart(outputOptions: any, _inputOptions: any) {
      const outDir = outputOptions.dir
      fs.rm(resolve(outDir, 'dev-icon-32.png'), () => console.log(`Deleted dev-icon-32.png from prod build`))
      fs.rm(resolve(outDir, 'dev-icon-64.png'), () => console.log(`Deleted dev-icon-64.png from prod build`))
    }
  }
}

function fixBuildPlugin() {
  return {
    name: 'fix-build',
    resolveId(source: string) {
      return source === 'virtual-module' ? source : null
    },
    closeBundle() {
      console.log(`Running fix manifest on vite close bundle event`);
      const manifestPath = join(outDir, "manifest.json");
      let manifest = JSON.parse(fs.readFileSync(manifestPath, { encoding: "utf8" }));
      if (!("web_accessible_resources" in manifest)) {
        console.log(`Warning: Manifest has not web_accessible_resources`);
        return;
      }
      for (const war of manifest['web_accessible_resources']) {
        war['matches'] = ['<all_urls>'];
      }
      manifest['web_accessible_resources'].push({
        resources: ["*.map"],
        matches: ['<all_urls>']
      })
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    }
  }
}

export default defineConfig(({ command, mode }) => {
  const isDev = mode === 'development';

  const extensionManifest = {
    ...manifest,
    ...(isDev ? devManifest : {} as ManifestV3Export),
    name: isDev ? `DEV: ${manifest.name}` : manifest.name,
    version: pkg.version,
  };

  return {
    resolve: {
      alias: {
        '@src': root,
        '@assets': assetsDir,
        '@pages': pagesDir,
        '@scripts': scriptsDir,
      },
    },
    plugins: [
      react(),
      crx({
        manifest: extensionManifest as ManifestV3Export,
        browser: 'chrome',
        contentScripts: {
          injectCss: true,
        }
      }),
      stripDevIcons(isDev),
      fixBuildPlugin()
    ],
    publicDir,
    build: {
      outDir,
      sourcemap: isDev,
      emptyOutDir: !isDev
    },
  }
});
