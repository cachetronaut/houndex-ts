import { chmod, mkdir, writeFile } from 'node:fs/promises';

await mkdir('dist/bin', { recursive: true });

const bin = `#!/usr/bin/env node
const { run } = await import('../packages/cli/src/cli.js');
await run();
`;

await writeFile('dist/bin/houndex.mjs', bin);
await chmod('dist/bin/houndex.mjs', 0o755);
