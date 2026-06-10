#!/usr/bin/env node
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from './cli.js';
import { parseGitUrl, buildOutputDirName } from './parser.js';
import { cloneRepo, getCurrentBranch } from './git.js';
import { buildChunks } from './chunker.js';
import { runChunk } from './repomixRunner.js';
import { BINARY_EXCLUDES } from './constants.js';

const main = async (): Promise<void> => {
  let opts: ReturnType<typeof parseArgs> | undefined;
  let identity: ReturnType<typeof parseGitUrl> | undefined;

  let tmpDir: string | undefined;
  try {
    opts = parseArgs(process.argv.slice(2));
    identity = parseGitUrl(opts.gitUrl);

    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'repomix-nlm-'));
    const repoDir = path.join(tmpDir, 'repo');

    console.log(`Cloning ${opts.gitUrl} ...`);
    await cloneRepo(opts.gitUrl, repoDir, opts.branch);

    const branch = await getCurrentBranch(repoDir);
    const outDirName = buildOutputDirName(identity, branch, new Date());
    const outDir = path.resolve(opts.outDir, outDirName);
    await mkdir(outDir, { recursive: true });
    console.log(`Output directory: ${outDir}`);

    console.log('Scanning files and computing chunks ...');
    const chunks = await buildChunks({
      rootDir: repoDir,
      threshold: opts.threshold,
      excludes: BINARY_EXCLUDES,
      compress: opts.compress,
    });
    console.log(`Planned ${chunks.length} chunk(s).`);

    for (const chunk of chunks) {
      console.log(`  → ${chunk.name}.txt (${chunk.words} words, ${chunk.files.length} files)`);
      await runChunk({
        rootDir: repoDir,
        outDir,
        chunkName: chunk.name,
        files: chunk.files,
        excludes: BINARY_EXCLUDES,
        compress: opts.compress,
        enableSecurityCheck: opts.enableSecurityCheck,
      });
    }

    console.log(`Done. ${chunks.length} file(s) written to ${outDir}`);
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exitCode = 1;
  } finally {
    if (tmpDir && opts && !opts.keepTmp) {
      try {
        await rm(tmpDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn(`Warning: 一時ディレクトリの削除に失敗しました: ${(cleanupError as Error).message}`);
      }
    } else if (tmpDir) {
      console.log(`(--keep-tmp) tmp retained at: ${tmpDir}`);
    }
  }
};

void main();
