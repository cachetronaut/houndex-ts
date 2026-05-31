/**
 * The `houndex` command-line shell. Thin: it reads config + input files, builds
 * the configured adapter + synthetic embedder, delegates to a command handler,
 * prints the result, and sets the process exit code. All logic lives in the
 * handlers + engine, which are tested directly.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Command } from 'commander';
import { createAdapter } from './adapterFactory.js';
import * as cmd from './commands.js';
import { CONFIG_FILENAME, defaultConfig, type HoundexConfig, parseConfig } from './config.js';
import { syntheticEmbedder } from './embedder.js';
import { EvalFileSchema, parseClaims, VerifyFileSchema } from './engine.js';

function loadConfig(cwd: string): HoundexConfig {
  const path = resolve(cwd, CONFIG_FILENAME);
  return existsSync(path) ? parseConfig(JSON.parse(readFileSync(path, 'utf8'))) : defaultConfig();
}

async function buildDeps(config: HoundexConfig): Promise<cmd.CommandDeps> {
  return {
    adapter: await createAdapter(config),
    config,
    embedder: syntheticEmbedder(config.embedding.dimensions),
    now: () => Date.now(),
  };
}

function emit(result: cmd.CommandResult): void {
  if (result.output.length > 0) process.stdout.write(`${result.output}\n`);
  process.exitCode = result.code;
}

/** Run an action; any thrown error is an operational failure (exit 2). */
async function guard(run: () => Promise<void> | void): Promise<void> {
  try {
    await run();
  } catch (err) {
    process.stderr.write(`error: ${(err as Error).message}\n`);
    process.exitCode = 2;
  }
}

export function buildProgram(cwd: string = process.cwd()): Command {
  const program = new Command();
  program.name('houndex').description('Verify RAG outputs against an evidence store.');

  program
    .command('init')
    .description('Write houndex.config.json')
    .option('--adapter <name>', 'local | supabase | convex')
    .option('--tenant <id>', 'tenant id')
    .option('--force', 'overwrite an existing config', false)
    .action((opts) =>
      guard(() => {
        const path = resolve(cwd, CONFIG_FILENAME);
        const result = cmd.init({
          adapter: opts.adapter,
          tenantId: opts.tenant,
          force: Boolean(opts.force),
          configExists: existsSync(path),
        });
        if (result.content !== undefined) writeFileSync(path, result.content);
        emit(result);
      }),
    );

  program
    .command('doctor')
    .description('Validate config and check adapter connectivity')
    .action(() =>
      guard(async () => {
        const config = loadConfig(cwd);
        emit(await cmd.doctor({ config, env: process.env, connect: () => createAdapter(config) }));
      }),
    );

  program
    .command('ingest <file>')
    .description('Load claims into the configured store')
    .option('--format <fmt>', 'json | jsonl', 'json')
    .option('--json', 'machine-readable output', false)
    .action((file, opts) =>
      guard(async () => {
        const config = loadConfig(cwd);
        const deps = await buildDeps(config);
        const text = readFileSync(resolve(cwd, file), 'utf8');
        const claims = parseClaims(text, opts.format === 'jsonl' ? 'jsonl' : 'json');
        emit(await cmd.ingest(deps, { claims, json: Boolean(opts.json) }));
      }),
    );

  program
    .command('ask <query>')
    .description('Retrieve grounded claims and emit a verified answer envelope')
    .option('--limit <n>', 'max claims', '10')
    .option('--json', 'machine-readable output', false)
    .action((query, opts) =>
      guard(async () => {
        const deps = await buildDeps(loadConfig(cwd));
        emit(await cmd.ask(deps, { query, limit: Number(opts.limit), json: Boolean(opts.json) }));
      }),
    );

  program
    .command('verify <file>')
    .description('Verify an answer envelope against the store (exit 1 on failure)')
    .option('--json', 'machine-readable output', false)
    .action((file, opts) =>
      guard(async () => {
        const deps = await buildDeps(loadConfig(cwd));
        const data = VerifyFileSchema.parse(JSON.parse(readFileSync(resolve(cwd, file), 'utf8')));
        emit(await cmd.verify(deps, { ...data, json: Boolean(opts.json) }));
      }),
    );

  program
    .command('eval <file>')
    .description('Score a fixture suite; exit 1 below --threshold')
    .option('--threshold <n>', 'minimum aggregate score to pass')
    .option('--json', 'machine-readable output', false)
    .action((file, opts) =>
      guard(async () => {
        const deps = await buildDeps(loadConfig(cwd));
        const data = EvalFileSchema.parse(JSON.parse(readFileSync(resolve(cwd, file), 'utf8')));
        emit(
          await cmd.evaluate(deps, {
            ...data,
            threshold: opts.threshold !== undefined ? Number(opts.threshold) : undefined,
            json: Boolean(opts.json),
          }),
        );
      }),
    );

  return program;
}

export async function run(argv: readonly string[] = process.argv): Promise<void> {
  await buildProgram().parseAsync(argv as string[]);
}

// Entry point when executed as the `houndex` bin.
if (import.meta.url === `file://${process.argv[1]}`) {
  await run();
}
