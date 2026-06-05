import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { buildChunkConfig, runChunk, type RunChunkOptions } from '../src/repomixRunner.js';

const baseOpts: RunChunkOptions = {
  rootDir: '/tmp/repo',
  outDir: '/out/owner-repo-main-20260529',
  chunkName: 'src-core',
  files: ['src/core/a.ts', 'src/core/b.ts'],
  excludes: ['**/*.svg'],
  compress: false,
};

describe('buildChunkConfig', () => {
  it('XML スタイルで .txt 拡張子を維持し、除外を含める', () => {
    const config = buildChunkConfig(baseOpts);
    expect(config.output.style).toBe('xml');
    expect(config.output.filePath).toBe(
      path.join('/out/owner-repo-main-20260529', 'src-core.txt'),
    );
    expect(config.output.filePath.endsWith('.txt')).toBe(true);
    expect(config.ignore.customPatterns).toContain('**/*.svg');
    expect(config.ignore.useDefaultPatterns).toBe(true);
    expect(config.output.compress).toBe(false);
  });

  it('compress フラグを反映する', () => {
    const config = buildChunkConfig({ ...baseOpts, compress: true });
    expect(config.output.compress).toBe(true);
  });

  it('セキュリティスキャンはデフォルトで有効', () => {
    const config = buildChunkConfig(baseOpts);
    expect(config.security.enableSecurityCheck).toBe(true);
  });

  it('enableSecurityCheck を無効化できる', () => {
    const config = buildChunkConfig({ ...baseOpts, enableSecurityCheck: false });
    expect(config.security.enableSecurityCheck).toBe(false);
  });

  it('enableSecurityCheck を明示的に有効化できる', () => {
    const config = buildChunkConfig({ ...baseOpts, enableSecurityCheck: true });
    expect(config.security.enableSecurityCheck).toBe(true);
  });
});

describe('runChunk', () => {
  it('pack を rootDir と explicitFiles 付きで呼び出す', async () => {
    const packMock = vi.fn().mockResolvedValue({ totalFiles: 2 });
    await runChunk(baseOpts, packMock);

    expect(packMock).toHaveBeenCalledTimes(1);
    const [rootDirs, config, , , explicitFiles] = packMock.mock.calls[0];
    expect(rootDirs).toEqual(['/tmp/repo']);
    expect(config.output.style).toBe('xml');
    expect(explicitFiles).toEqual(['/tmp/repo/src/core/a.ts', '/tmp/repo/src/core/b.ts']);
  });
});
