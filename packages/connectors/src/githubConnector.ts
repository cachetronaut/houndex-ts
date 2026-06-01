import type { ScrapedPage } from 'houndex/core';
import type { Connector } from './connector.js';

const DEFAULT_INCLUDE = ['.md', '.txt', '.json'] as const;
const DEFAULT_REF = 'main';

export interface GitHubRepository {
  owner: string;
  repo: string;
  ref?: string;
}

export interface GitHubFileRef {
  path: string;
  sha?: string;
}

export interface GitHubClient {
  listFiles(repository: Required<GitHubRepository>): Promise<GitHubFileRef[]>;
  readFile(repository: Required<GitHubRepository>, file: GitHubFileRef): Promise<string>;
}

export interface GitHubConnectorError {
  path: string;
  error: unknown;
}

export interface GitHubConnectorOptions {
  repository: GitHubRepository;
  include?: readonly string[];
  client?: GitHubClient;
  onError?: (event: GitHubConnectorError) => void;
}

export class GitHubConnector implements Connector {
  readonly name = 'github';
  private readonly repository: Required<GitHubRepository>;
  private readonly include: ReadonlySet<string>;
  private readonly client: GitHubClient;
  private readonly onError: ((event: GitHubConnectorError) => void) | undefined;

  constructor(options: GitHubConnectorOptions) {
    this.repository = {
      owner: options.repository.owner,
      repo: options.repository.repo,
      ref: options.repository.ref ?? DEFAULT_REF,
    };
    this.include = new Set(options.include ?? DEFAULT_INCLUDE);
    this.client = options.client ?? new DefaultGitHubClient();
    this.onError = options.onError;
  }

  async *pages(): AsyncIterable<ScrapedPage> {
    const files = (await this.client.listFiles(this.repository))
      .filter((file) => this.include.has(extensionForPath(file.path)))
      .sort((left, right) => comparePaths(left.path, right.path));

    for (const file of files) {
      try {
        const text = await this.client.readFile(this.repository, file);
        yield {
          sourceUrl: sourceUrlForFile(this.repository, file.path),
          title: file.path,
          text,
        };
      } catch (error) {
        this.onError?.({ path: file.path, error });
      }
    }
  }
}

export interface DefaultGitHubClientOptions {
  token?: string;
}

export class DefaultGitHubClient implements GitHubClient {
  private readonly token: string | undefined;

  constructor(options: DefaultGitHubClientOptions = {}) {
    this.token = options.token;
  }

  async listFiles(repository: Required<GitHubRepository>): Promise<GitHubFileRef[]> {
    const url = `https://api.github.com/repos/${repository.owner}/${repository.repo}/git/trees/${repository.ref}?recursive=1`;
    const response = await fetch(url, { headers: this.headers() });
    if (!response.ok) throw new Error(`GitHub tree request failed with status ${response.status}`);
    const payload = (await response.json()) as {
      tree?: Array<{ path?: string; type?: string; sha?: string }>;
    };
    return (payload.tree ?? [])
      .filter((entry) => entry.type === 'blob' && entry.path !== undefined)
      .map((entry) => ({ path: entry.path as string, sha: entry.sha }));
  }

  async readFile(repository: Required<GitHubRepository>, file: GitHubFileRef): Promise<string> {
    const response = await fetch(rawUrlForFile(repository, file.path), { headers: this.headers() });
    if (!response.ok) throw new Error(`GitHub raw request failed with status ${response.status}`);
    return response.text();
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'houndex-connectors/0.1',
    };
    if (this.token !== undefined) headers.Authorization = `Bearer ${this.token}`;
    return headers;
  }
}

function extensionForPath(filePath: string): string {
  const lastSlash = filePath.lastIndexOf('/');
  const fileName = lastSlash === -1 ? filePath : filePath.slice(lastSlash + 1);
  const dot = fileName.lastIndexOf('.');
  return dot === -1 ? '' : fileName.slice(dot);
}

function comparePaths(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function sourceUrlForFile(repository: Required<GitHubRepository>, filePath: string): string {
  return `https://github.com/${repository.owner}/${repository.repo}/blob/${repository.ref}/${encodePath(filePath)}`;
}

function rawUrlForFile(repository: Required<GitHubRepository>, filePath: string): string {
  return `https://raw.githubusercontent.com/${repository.owner}/${repository.repo}/${repository.ref}/${encodePath(filePath)}`;
}

function encodePath(filePath: string): string {
  return filePath
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}
