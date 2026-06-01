#!/usr/bin/env node
import { dirname, resolve } from 'node:path';
/**
 * `houndex` bin. The package ships TypeScript sources (no build step), so the
 * bin registers the tsx ESM loader and then runs the CLI entry.
 */
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const { register } = await import('tsx/esm/api');
register();
const { run } = await import(resolve(here, '../src/cli.ts'));
await run();
