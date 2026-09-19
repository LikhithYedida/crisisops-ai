import {
  copyFileSync,
  mkdirSync,
} from "node:fs";

import {
  createRequire,
} from "node:module";

import path from "node:path";

const require =
  createRequire(
    import.meta.url,
  );

const packagePath =
  require.resolve(
    "maplibre-gl/package.json",
  );

const distDirectory =
  path.join(
    path.dirname(packagePath),
    "dist",
  );

const destinationDirectory =
  path.join(
    process.cwd(),
    "public",
    "maplibre",
  );

mkdirSync(
  destinationDirectory,
  {
    recursive: true,
  },
);

const files = [
  "maplibre-gl-worker.mjs",
  "maplibre-gl-shared.mjs",
];

for (const file of files) {
  copyFileSync(
    path.join(
      distDirectory,
      file,
    ),
    path.join(
      destinationDirectory,
      file,
    ),
  );

  console.log(
    `Copied MapLibre file: ${file}`,
  );
}

console.log(
  "MapLibre worker files ready.",
);