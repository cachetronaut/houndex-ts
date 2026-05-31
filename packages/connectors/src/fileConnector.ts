import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ScrapedPage } from '@houndex/core';
import type { Connector } from './connector.js';

const DEFAULT_INCLUDE = ['.md', '.txt', '.json'] as const;

export interface FileConnectorOptions {
  root: string;
  include?: readonly string[];
  baseUrl?: string;
}

export class FileConnector implements Connector {
  readonly name = 'file';
  private readonly root: string;
  private readonly include: ReadonlySet<string>;
  private readonly baseUrl: string | undefined;

  constructor(options: FileConnectorOptions) {
    this.root = path.resolve(options.root);
    this.include = new Set(options.include ?? DEFAULT_INCLUDE);
    this.baseUrl = options.baseUrl;
  }

  async *pages(): AsyncIterable<ScrapedPage> {
    const files = await listFiles(this.root, this.include);
    for (const filePath of files) {
      const text = await readFile(filePath, 'utf8');
      const relativePath = path.relative(this.root, filePath).split(path.sep).join('/');
      yield {
        sourceUrl: this.sourceUrl(filePath, relativePath),
        title: path.basename(filePath),
        text,
      };
    }
  }

  private sourceUrl(filePath: string, relativePath: string): string {
    if (this.baseUrl === undefined) return pathToFileURL(filePath).href;
    const baseUrl = this.baseUrl.replace(/\/+$/, '');
    return `${baseUrl}/${relativePath
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/')}`;
  }
}

async function listFiles(root: string, include: ReadonlySet<string>): Promise<string[]> {
  const files: string[] = [];

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(entryPath);
      } else if (entry.isFile() && include.has(path.extname(entry.name))) {
        files.push(entryPath);
      }
    }
  }

  await visit(root);
  return files.sort((left, right) =>
    path.relative(root, left).localeCompare(path.relative(root, right)),
  );
}
