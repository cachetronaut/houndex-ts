import { describe, expect, it } from 'vitest';
import {
  type GitHubClient,
  GitHubConnector,
  type GitHubConnectorError,
  type GitHubFileRef,
  type GitHubRepository,
} from './githubConnector.js';

class FakeGitHubClient implements GitHubClient {
  constructor(
    private readonly files: GitHubFileRef[],
    private readonly contents: ReadonlyMap<string, string | Error>,
  ) {}

  async listFiles(_repository: Required<GitHubRepository>): Promise<GitHubFileRef[]> {
    return this.files;
  }

  async readFile(_repository: Required<GitHubRepository>, file: GitHubFileRef): Promise<string> {
    const content = this.contents.get(file.path);
    if (content === undefined) throw new Error(`missing fake content for ${file.path}`);
    if (content instanceof Error) throw content;
    return content;
  }
}

describe('GitHubConnector', () => {
  it('lists included repository files in sorted path order', async () => {
    const client = new FakeGitHubClient(
      [
        { path: 'docs/b.txt' },
        { path: 'image.png' },
        { path: 'README.md' },
        { path: 'docs/a.json' },
      ],
      new Map([
        ['README.md', 'readme'],
        ['docs/a.json', '{"value":true}'],
        ['docs/b.txt', 'text'],
      ]),
    );
    const connector = new GitHubConnector({
      repository: { owner: 'octo', repo: 'repo', ref: 'trunk' },
      client,
    });

    const pages = [];
    for await (const page of connector.pages()) pages.push(page);

    expect(pages).toEqual([
      {
        sourceUrl: 'https://github.com/octo/repo/blob/trunk/README.md',
        title: 'README.md',
        text: 'readme',
      },
      {
        sourceUrl: 'https://github.com/octo/repo/blob/trunk/docs/a.json',
        title: 'docs/a.json',
        text: '{"value":true}',
      },
      {
        sourceUrl: 'https://github.com/octo/repo/blob/trunk/docs/b.txt',
        title: 'docs/b.txt',
        text: 'text',
      },
    ]);
  });

  it('skips file read failures and reports them through onError', async () => {
    const errors: GitHubConnectorError[] = [];
    const client = new FakeGitHubClient(
      [{ path: 'ok.md' }, { path: 'bad.md' }],
      new Map<string, string | Error>([
        ['ok.md', 'ok'],
        ['bad.md', new TypeError('read failed')],
      ]),
    );
    const connector = new GitHubConnector({
      repository: { owner: 'octo', repo: 'repo' },
      client,
      onError: (event) => errors.push(event),
    });

    const pages = [];
    for await (const page of connector.pages()) pages.push(page);

    expect(pages.map((page) => page.sourceUrl)).toEqual([
      'https://github.com/octo/repo/blob/main/ok.md',
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.path).toBe('bad.md');
    expect(errors[0]?.error).toBeInstanceOf(TypeError);
  });
});
