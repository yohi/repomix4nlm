import { describe, expect, it } from 'vitest';
import {
  binPack,
  chunkNameFromFiles,
  commonParentDir,
  countWords,
  nameChunks,
  type FileEntry,
} from '../src/chunker.js';

describe('countWords', () => {
  it('空白・改行区切りで語数を数える', () => {
    expect(countWords('hello world\nfoo  bar')).toBe(4);
  });
  it('空文字や空白のみは 0 語', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   \n  ')).toBe(0);
  });
});

describe('commonParentDir', () => {
  it('同一ディレクトリ配下なら共通親を返す', () => {
    expect(commonParentDir(['src/core/a.ts', 'src/core/b.ts'])).toBe('src/core');
  });
  it('サブディレクトリが分岐するなら上位の共通親を返す', () => {
    expect(commonParentDir(['src/a/x.ts', 'src/b/y.ts'])).toBe('src');
  });
  it('ルート直下ファイルのみなら root を返す', () => {
    expect(commonParentDir(['README.md', 'package.json'])).toBe('root');
  });
});

describe('chunkNameFromFiles', () => {
  it('複数ファイルは共通親ディレクトリをハイフン連結', () => {
    expect(chunkNameFromFiles(['src/core/metrics/a.ts', 'src/core/metrics/b.ts']))
      .toBe('src-core-metrics');
  });
  it('単一ファイルはパス全体をハイフン連結（拡張子保持）', () => {
    expect(chunkNameFromFiles(['dist/bundle.js'])).toBe('dist-bundle.js');
  });
  it('ルート直下の複数ファイルは root', () => {
    expect(chunkNameFromFiles(['README.md', 'LICENSE'])).toBe('root');
  });
});

describe('binPack', () => {
  const f = (relPath: string, words: number): FileEntry => ({ relPath, words });

  it('閾値内なら1チャンクにまとめる', () => {
    const groups = binPack([f('a', 100), f('b', 100)], 1000);
    expect(groups).toHaveLength(1);
    expect(groups[0].map((e) => e.relPath)).toEqual(['a', 'b']);
  });

  it('閾値を超えたら新チャンクに分ける', () => {
    const groups = binPack([f('a', 600), f('b', 600)], 1000);
    expect(groups).toHaveLength(2);
  });

  it('単一ファイルが閾値超なら独立チャンクにする', () => {
    const groups = binPack([f('a', 100), f('big', 5000), f('b', 100)], 1000);
    expect(groups).toHaveLength(3);
    expect(groups[1].map((e) => e.relPath)).toEqual(['big']);
  });
});

describe('nameChunks', () => {
  it('語数合計と一意名を付与する', () => {
    const chunks = nameChunks([
      [{ relPath: 'src/core/a.ts', words: 100 }, { relPath: 'src/core/b.ts', words: 200 }],
    ]);
    expect(chunks[0].name).toBe('src-core');
    expect(chunks[0].words).toBe(300);
    expect(chunks[0].files).toEqual(['src/core/a.ts', 'src/core/b.ts']);
  });

  it('同一主要ディレクトリが複数チャンクに跨る場合は chunkN 連番を付与', () => {
    const chunks = nameChunks([
      [{ relPath: 'src/comp/Home/a.ts', words: 1 }, { relPath: 'src/comp/Home/b.ts', words: 1 }],
      [{ relPath: 'src/comp/Home/c.ts', words: 1 }, { relPath: 'src/comp/Home/d.ts', words: 1 }],
    ]);
    expect(chunks.map((c) => c.name)).toEqual([
      'src-comp-Home-chunk1',
      'src-comp-Home-chunk2',
    ]);
  });
});

import { buildChunks } from '../src/chunker.js';

describe('buildChunks', () => {
  it('searchFiles の結果を語数集計しソートしてチャンク化する', async () => {
    const fakeSearch = async () => ({ filePaths: ['src/b.ts', 'src/a.ts'], emptyDirPaths: [] });
    const fakeRead = async (abs: string) =>
      abs.endsWith('a.ts') ? 'one two three' : 'four five';

    const chunks = await buildChunks({
      rootDir: '/tmp/repo',
      threshold: 1000,
      excludes: ['**/*.svg'],
      compress: false,
      deps: { searchFiles: fakeSearch, readFile: fakeRead },
    });

    expect(chunks).toHaveLength(1);
    // sortPaths により a.ts が b.ts より前
    expect(chunks[0].files).toEqual(['src/a.ts', 'src/b.ts']);
    expect(chunks[0].words).toBe(5); // 3 + 2
    expect(chunks[0].name).toBe('src');
  });

  it('閾値を超えると複数チャンクに分割する', async () => {
    const fakeSearch = async () => ({ filePaths: ['src/a.ts', 'src/b.ts'], emptyDirPaths: [] });
    const fakeRead = async () => 'w '.repeat(60); // 60 語

    const chunks = await buildChunks({
      rootDir: '/tmp/repo',
      threshold: 100,
      excludes: [],
      compress: false,
      deps: { searchFiles: fakeSearch, readFile: fakeRead },
    });

    expect(chunks).toHaveLength(2);
  });
});
