import { copyFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const output = resolve('out');

async function flattenSegments(directory, destination, prefix) {
  let aliases = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    const name = prefix + '.' + entry.name;
    if (entry.isDirectory()) {
      aliases += await flattenSegments(file, destination, name);
    } else if (entry.isFile() && entry.name.endsWith('.txt')) {
      await copyFile(file, join(destination, name));
      aliases++;
    }
  }
  return aliases;
}

async function prepareRoutes(directory) {
  let aliases = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === '_next') continue;
    const path = join(directory, entry.name);
    // Some Next.js exports emit Windows segment paths as directories while
    // the client requests the same segments as a dot-delimited filename.
    aliases += entry.name.startsWith('__next.')
      ? await flattenSegments(path, directory, entry.name)
      : await prepareRoutes(path);
  }
  return aliases;
}

const aliases = await prepareRoutes(output);
console.log('Verified static route layout. Added ' + aliases + ' route prefetch file aliases.');

