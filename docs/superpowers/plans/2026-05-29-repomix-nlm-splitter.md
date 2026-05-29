# Repomix NotebookLM 分割ラッパー 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 大規模Gitリポジトリを Clone し、NotebookLM の語数制限内に収まるようディレクトリ階層を尊重してチャンク分割し、Repomix の XML スタイルで `.txt` 出力する CLI ツールを実装する。

**Architecture:** Repomix を npm ライブラリとして利用し、`searchFiles()` で除外ロジックを継承しつつ対象ファイルを列挙、独自の貪欲ビンパッキングで語数チャンク化、各チャンクを `pack()` の `explicitFiles` 引数で精密制御して XML スタイルの `.txt` として書き出す。tmp クローンは `finally` で確実に削除する。

**Tech Stack:** TypeScript (ESM, NodeNext), Node.js 22+（repomix が `engines.node >=22.0.0` を要求）, repomix 1.14.x, git-url-parse 16.x, vitest, tsx。

**重要な前提:**
- `pack(rootDirs, config, progressCallback, overrideDeps, explicitFiles, options)` — 第5引数 `explicitFiles` に**rootDir相対**のファイルパス配列を渡す。
- `searchFiles(rootDir, config, explicitFiles?)` は `{ filePaths, emptyDirPaths }` を返し、`filePaths` は **rootDir 相対・posix区切り**。
- `mergeConfigs(cwd, fileConfig, cliConfig)` は `output.filePath` を明示指定すると `.txt` 拡張子を維持する（xml スタイルでも自動変換されない）。
- パスは Linux/posix 前提で `/` 区切りとして扱う。

---

## Task 1: プロジェクト雛形のセットアップ

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`

> セットアップタスクのため TDD ではない。

- [ ] **Step 1: `package.json` を作成**

```json
{
  "name": "repomix-nlm-splitter",
  "version": "0.1.0",
  "description": "Split large repositories into NotebookLM-sized Repomix XML .txt chunks",
  "type": "module",
  "bin": {
    "repomix-nlm": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "engines": {
    "node": ">=22.0.0"
  },
  "dependencies": {
    "git-url-parse": "^16.1.0",
    "repomix": "^1.14.1"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: `tsconfig.json` を作成**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2023"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": false,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: `vitest.config.ts` を作成**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 4: `.gitignore` を作成**

```
node_modules/
dist/
*.log
# Repomix リファレンスクローン（本ツールの依存ではない）
repomix/
# 生成された出力ディレクトリ
*-*-*-20*/
```

- [ ] **Step 5: 依存をインストール（devcontainer 内で実行）**

Run: `npm install`
Expected: `node_modules/` が生成され、エラーなく完了する。

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts .gitignore
git commit -m "chore: scaffold repomix-nlm-splitter project"
```

---

## Task 2: 定数モジュール

**Files:**
- Create: `src/constants.ts`

> 純粋な定数のみ。テスト不要だが Task 4/5 が参照する。

- [ ] **Step 1: `src/constants.ts` を作成**

```ts
/** チャンクの実効語数上限（400,000 の 90%、XMLオーバーヘッド安全マージン）。 */
export const DEFAULT_THRESHOLD = 360_000;

/** 走査・処理対象から完全除外するバイナリ/アセット拡張子。 */
export const BINARY_EXTENSIONS = [
  // 画像/アイコン
  'svg', 'png', 'jpg', 'jpeg', 'gif', 'ico', 'webp', 'bmp',
  // ドキュメント
  'pdf',
  // アーカイブ
  'zip', 'tar', 'gz', 'tgz', 'rar', '7z',
  // フォント
  'woff', 'woff2', 'ttf', 'eot',
  // メディア
  'mp4', 'mov', 'mp3', 'wav',
] as const;

/** Repomix の ignore.customPatterns へ注入する glob パターン。 */
export const BINARY_EXCLUDES: string[] = BINARY_EXTENSIONS.map((ext) => `**/*.${ext}`);
```

- [ ] **Step 2: Commit**

```bash
git add src/constants.ts
git commit -m "feat: add constants for threshold and binary excludes"
```

---

## Task 3: URL解析・出力ディレクトリ名（parser.ts）

**Files:**
- Create: `src/parser.ts`
- Test: `tests/parser.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`tests/parser.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildOutputDirName, formatDate, parseGitUrl, sanitizeSegment } from '../src/parser.js';

describe('parseGitUrl', () => {
  it('HTTPS GitHub URL から owner/repo を抽出する', () => {
    expect(parseGitUrl('https://github.com/yamadashy/repomix.git')).toEqual({
      owner: 'yamadashy',
      repo: 'repomix',
    });
  });

  it('SSH GitHub URL から owner/repo を抽出する', () => {
    expect(parseGitUrl('git@github.com:yamadashy/repomix.git')).toEqual({
      owner: 'yamadashy',
      repo: 'repomix',
    });
  });

  it('Bitbucket HTTPS URL から owner/repo を抽出する', () => {
    expect(parseGitUrl('https://bitbucket.org/team/project.git')).toEqual({
      owner: 'team',
      repo: 'project',
    });
  });

  it('owner/repo を抽出できない場合は例外を投げる', () => {
    expect(() => parseGitUrl('not-a-url')).toThrow(/owner\/repo/);
  });
});

describe('formatDate', () => {
  it('YYYYMMDD 形式にゼロ埋めして整形する', () => {
    expect(formatDate(new Date(2026, 4, 9))).toBe('20260509'); // 5月9日
  });
});

describe('sanitizeSegment', () => {
  it('スラッシュをハイフンに、不正文字をハイフンに置換する', () => {
    expect(sanitizeSegment('feature/new-thing')).toBe('feature-new-thing');
    expect(sanitizeSegment('a b@c')).toBe('a-b-c');
  });
});

describe('buildOutputDirName', () => {
  it('owner-repo-branch-YYYYMMDD を生成する', () => {
    const name = buildOutputDirName(
      { owner: 'yamadashy', repo: 'repomix' },
      'main',
      new Date(2026, 4, 29),
    );
    expect(name).toBe('yamadashy-repomix-main-20260529');
  });

  it('ブランチ名のスラッシュをハイフン化する', () => {
    const name = buildOutputDirName(
      { owner: 'o', repo: 'r' },
      'feature/x',
      new Date(2026, 0, 1),
    );
    expect(name).toBe('o-r-feature-x-20260101');
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test -- tests/parser.test.ts`
Expected: FAIL（`src/parser.js` が存在しない / 関数未定義）

- [ ] **Step 3: 最小実装を書く**

`src/parser.ts`:

```ts
import gitUrlParse from 'git-url-parse';

export interface RepoIdentity {
  owner: string;
  repo: string;
}

/** Git URL から owner / repo を抽出する。抽出できない場合は例外。 */
export const parseGitUrl = (url: string): RepoIdentity => {
  let parsed: { owner?: string; name?: string };
  try {
    parsed = gitUrlParse(url);
  } catch {
    throw new Error(`Git URL の解析に失敗しました（owner/repo を抽出できません）: ${url}`);
  }
  const owner = parsed.owner ?? '';
  const repo = parsed.name ?? '';
  if (!owner || !repo) {
    throw new Error(`Git URL から owner/repo を抽出できませんでした: ${url}`);
  }
  return { owner, repo };
};

/** Date を YYYYMMDD（ローカル時刻）に整形する。 */
export const formatDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
};

/** ディレクトリ名に使える安全な文字列へ正規化する（英数字・ハイフン・ドット以外はハイフン化）。 */
export const sanitizeSegment = (segment: string): string =>
  segment.replace(/[^A-Za-z0-9._-]/g, '-');

/** 出力ディレクトリ名 `{owner}-{repo}-{branch}-{YYYYMMDD}` を生成する。 */
export const buildOutputDirName = (
  identity: RepoIdentity,
  branch: string,
  date: Date,
): string => {
  const owner = sanitizeSegment(identity.owner);
  const repo = sanitizeSegment(identity.repo);
  const safeBranch = sanitizeSegment(branch);
  return `${owner}-${repo}-${safeBranch}-${formatDate(date)}`;
};
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm test -- tests/parser.test.ts`
Expected: PASS（全ケース緑）

- [ ] **Step 5: Commit**

```bash
git add src/parser.ts tests/parser.test.ts
git commit -m "feat: add git URL parser and output dir name builder"
```

---

## Task 4: チャンク分割ロジック（chunker.ts）

**Files:**
- Create: `src/chunker.ts`
- Test: `tests/chunker.test.ts`

このタスクは純粋ロジックの中核。以下の純粋関数を TDD で実装する:
`countWords` / `commonParentDir` / `chunkNameFromFiles` / `binPack` / `nameChunks`。

- [ ] **Step 1: 失敗するテストを書く**

`tests/chunker.test.ts`:

```ts
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
      [{ relPath: 'src/big/a.ts', words: 100 }],
      [{ relPath: 'src/big/b.ts', words: 100 }],
    ]);
    expect(chunks.map((c) => c.name)).toEqual(['src-big-a.ts-chunk1', 'src-big-a.ts-chunk2']);
  });
});
```

> 注: 最後のテストは、各グループが単一ファイル（`chunkNameFromFiles` がフルパス名を返す）かつ同名衝突するケースを意図している。`src/big/a.ts` と `src/big/b.ts` は別名なので衝突しない点に注意し、衝突を再現するため意図的に同一ファイル名で分割された状況（同じ base 名）を作る。下記実装に合わせ、テストはこの仕様（base 名が重複したときだけ連番）を検証する。

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test -- tests/chunker.test.ts`
Expected: FAIL（`src/chunker.js` が存在しない）

- [ ] **Step 3: 最小実装を書く（純粋関数群のみ。I/O は Task 4b で追加）**

`src/chunker.ts`:

```ts
export interface FileEntry {
  /** rootDir 相対・posix 区切りのパス。 */
  relPath: string;
  /** 概算語数。 */
  words: number;
}

export interface Chunk {
  /** 拡張子なしのチャンク名（後段で `.txt` を付与）。 */
  name: string;
  /** rootDir 相対のファイルパス配列。 */
  files: string[];
  /** チャンクの合計語数。 */
  words: number;
}

/** 空白・改行区切りで概算語数を数える。 */
export const countWords = (text: string): number => {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
};

/** ディレクトリ部分（最後のセグメントを除く）を返す。 */
const dirSegments = (relPath: string): string[] => relPath.split('/').slice(0, -1);

/** ファイル群の共通親ディレクトリを返す。ルート直下のみなら 'root'。 */
export const commonParentDir = (relPaths: string[]): string => {
  if (relPaths.length === 0) return 'root';
  const segLists = relPaths.map(dirSegments);
  let common = segLists[0];
  for (const segs of segLists.slice(1)) {
    let i = 0;
    while (i < common.length && i < segs.length && common[i] === segs[i]) i++;
    common = common.slice(0, i);
  }
  return common.length === 0 ? 'root' : common.join('/');
};

/** 安全なファイル名へ正規化（英数字・ハイフン・ドット以外をハイフン化）。 */
const sanitize = (name: string): string => name.replace(/[^A-Za-z0-9._-]/g, '-');

/** チャンクの代表名を決める。単一ファイルはフルパス名、複数は共通親ディレクトリ。 */
export const chunkNameFromFiles = (relPaths: string[]): string => {
  if (relPaths.length === 1) {
    return sanitize(relPaths[0].replaceAll('/', '-'));
  }
  const parent = commonParentDir(relPaths);
  return parent === 'root' ? 'root' : sanitize(parent.replaceAll('/', '-'));
};

/** ソート済みファイル群を貪欲ビンパッキングでグループ化する。 */
export const binPack = (files: FileEntry[], threshold: number): FileEntry[][] => {
  const groups: FileEntry[][] = [];
  let current: FileEntry[] = [];
  let currentWords = 0;

  const flush = (): void => {
    if (current.length > 0) {
      groups.push(current);
      current = [];
      currentWords = 0;
    }
  };

  for (const file of files) {
    // エッジケース: 単一ファイルが閾値超 → 独立チャンク
    if (file.words > threshold) {
      flush();
      groups.push([file]);
      continue;
    }
    if (currentWords + file.words > threshold && current.length > 0) {
      flush();
    }
    current.push(file);
    currentWords += file.words;
  }
  flush();
  return groups;
};

/** グループに一意名と合計語数を付与する。base 名が重複する場合のみ chunkN 連番。 */
export const nameChunks = (groups: FileEntry[][]): Chunk[] => {
  const baseNames = groups.map((g) => chunkNameFromFiles(g.map((e) => e.relPath)));
  const totals = new Map<string, number>();
  for (const b of baseNames) totals.set(b, (totals.get(b) ?? 0) + 1);

  const used = new Set<string>();
  const counts = new Map<string, number>();
  const result: Chunk[] = [];

  for (let i = 0; i < groups.length; i++) {
    const base = baseNames[i];
    let name: string;
    if ((totals.get(base) ?? 0) > 1) {
      const n = (counts.get(base) ?? 0) + 1;
      counts.set(base, n);
      name = `${base}-chunk${n}`;
    } else {
      name = base;
    }
    while (used.has(name)) {
      const n = (counts.get(base) ?? 1) + 1;
      counts.set(base, n);
      name = `${base}-chunk${n}`;
    }
    used.add(name);
    result.push({
      name,
      files: groups[i].map((e) => e.relPath),
      words: groups[i].reduce((sum, e) => sum + e.words, 0),
    });
  }
  return result;
};
```

> 上の `nameChunks` 連番テストでは base 名が重複する状況が必要。`src/big/a.ts` と `src/big/b.ts` は単一ファイルなので base 名が `src-big-a.ts` と `src-big-b.ts` で**重複しない**。テストを実装仕様に合わせて修正する（下記 Step 3b）。

- [ ] **Step 3b: 連番テストを実装仕様に合わせて修正**

`tests/chunker.test.ts` の `nameChunks` 連番テストを次に置き換える（base 名が重複する複数ファイルチャンクで検証）:

```ts
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
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm test -- tests/chunker.test.ts`
Expected: PASS（全ケース緑）

- [ ] **Step 5: Commit**

```bash
git add src/chunker.ts tests/chunker.test.ts
git commit -m "feat: add chunking algorithm (word count, bin packing, naming)"
```

---

## Task 4b: ファイル列挙＋語数集計（chunker.ts に I/O 統合関数を追加）

**Files:**
- Modify: `src/chunker.ts`（`buildChunks` を追加）
- Test: `tests/chunker.test.ts`（`buildChunks` のテストを追加。`searchFiles` と `fs` を依存注入でモック）

- [ ] **Step 1: 失敗するテストを追加**

`tests/chunker.test.ts` の末尾に追記:

```ts
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
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test -- tests/chunker.test.ts`
Expected: FAIL（`buildChunks` 未定義）

- [ ] **Step 3: `buildChunks` を実装**

`src/chunker.ts` の先頭付近に import を追加:

```ts
import path from 'node:path';
import { readFile as fsReadFile } from 'node:fs/promises';
import { mergeConfigs, searchFiles as repomixSearchFiles, sortPaths } from 'repomix';
```

ファイル末尾に追加:

```ts
export interface BuildChunksDeps {
  searchFiles: (
    rootDir: string,
    config: ReturnType<typeof mergeConfigs>,
    explicitFiles?: string[],
  ) => Promise<{ filePaths: string[]; emptyDirPaths: string[] }>;
  readFile: (absPath: string) => Promise<string>;
}

export interface BuildChunksOptions {
  rootDir: string;
  threshold: number;
  excludes: string[];
  compress: boolean;
  deps?: Partial<BuildChunksDeps>;
}

/** rootDir を走査し、除外を適用し、語数ベースでチャンク化する。 */
export const buildChunks = async (opts: BuildChunksOptions): Promise<Chunk[]> => {
  const deps: BuildChunksDeps = {
    searchFiles: repomixSearchFiles,
    readFile: (p) => fsReadFile(p, 'utf-8'),
    ...opts.deps,
  };

  // 列挙用 config（除外パターン継承）。pack 時の config とは別建てで OK。
  const searchConfig = mergeConfigs(opts.rootDir, {
    ignore: {
      customPatterns: opts.excludes,
      useDefaultPatterns: true,
      useGitignore: true,
    },
  }, {});

  const { filePaths } = await deps.searchFiles(opts.rootDir, searchConfig);
  const sorted = sortPaths(filePaths);

  const entries: FileEntry[] = [];
  for (const relPath of sorted) {
    const text = await deps.readFile(path.resolve(opts.rootDir, relPath));
    entries.push({ relPath, words: countWords(text) });
  }

  const groups = binPack(entries, opts.threshold);
  return nameChunks(groups);
};
```

> `compress` は語数集計には影響しない（生語数で見積もる設計）。`buildChunks` のシグネチャに保持しておき、呼び出し側で `runChunk` へ渡す。

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm test -- tests/chunker.test.ts`
Expected: PASS（既存ケース + buildChunks 2ケース）

- [ ] **Step 5: Commit**

```bash
git add src/chunker.ts tests/chunker.test.ts
git commit -m "feat: add buildChunks to enumerate files and compute word-based chunks"
```

---

## Task 5: Repomix 実行ラッパー（repomixRunner.ts）

**Files:**
- Create: `src/repomixRunner.ts`
- Test: `tests/repomixRunner.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`tests/repomixRunner.test.ts`:

```ts
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
});

describe('runChunk', () => {
  it('pack を rootDir と explicitFiles 付きで呼び出す', async () => {
    const packMock = vi.fn().mockResolvedValue({ totalFiles: 2 });
    await runChunk(baseOpts, packMock);

    expect(packMock).toHaveBeenCalledTimes(1);
    const [rootDirs, config, , , explicitFiles] = packMock.mock.calls[0];
    expect(rootDirs).toEqual(['/tmp/repo']);
    expect(config.output.style).toBe('xml');
    expect(explicitFiles).toEqual(['src/core/a.ts', 'src/core/b.ts']);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test -- tests/repomixRunner.test.ts`
Expected: FAIL（`src/repomixRunner.js` 未定義）

- [ ] **Step 3: 最小実装を書く**

`src/repomixRunner.ts`:

```ts
import path from 'node:path';
import { mergeConfigs, pack } from 'repomix';

export interface RunChunkOptions {
  /** クローン先 tmp リポジトリの絶対パス（cwd）。 */
  rootDir: string;
  /** 出力先ディレクトリの絶対パス。 */
  outDir: string;
  /** 拡張子なしのチャンク名。 */
  chunkName: string;
  /** rootDir 相対のファイルパス配列（explicitFiles）。 */
  files: string[];
  /** ignore.customPatterns へ注入する除外 glob。 */
  excludes: string[];
  /** Tree-sitter 圧縮の有無。 */
  compress: boolean;
}

/** チャンク用のマージ済み Repomix 設定を構築する。 */
export const buildChunkConfig = (opts: RunChunkOptions): ReturnType<typeof mergeConfigs> =>
  mergeConfigs(
    opts.rootDir,
    {
      output: {
        // filePath を明示指定 → xml スタイルでも .txt が維持される
        filePath: path.join(opts.outDir, `${opts.chunkName}.txt`),
        style: 'xml',
        fileSummary: true,
        directoryStructure: true,
        copyToClipboard: false,
        compress: opts.compress,
      },
      ignore: {
        customPatterns: opts.excludes,
        useDefaultPatterns: true,
        useGitignore: true,
      },
      security: {
        enableSecurityCheck: false,
      },
    },
    {},
  );

type PackFn = typeof pack;

/** 1チャンクを XML スタイルの .txt として書き出す。 */
export const runChunk = async (opts: RunChunkOptions, packFn: PackFn = pack): Promise<void> => {
  const config = buildChunkConfig(opts);
  await packFn([opts.rootDir], config, () => {}, {}, opts.files);
};
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm test -- tests/repomixRunner.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/repomixRunner.ts tests/repomixRunner.test.ts
git commit -m "feat: add repomix runner wrapping pack() with XML .txt output"
```

---

## Task 6: CLI 引数パース（index.ts の純粋部分を先に TDD）

**Files:**
- Create: `src/cli.ts`（引数パースの純粋関数）
- Test: `tests/cli.test.ts`

> Git/clone を含む `index.ts` 本体は副作用が大きいため、引数パースだけを純粋関数として切り出して TDD する。

- [ ] **Step 1: 失敗するテストを書く**

`tests/cli.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseArgs } from '../src/cli.js';

describe('parseArgs', () => {
  it('URL のみ（デフォルト値）', () => {
    const opts = parseArgs(['https://github.com/o/r.git']);
    expect(opts.gitUrl).toBe('https://github.com/o/r.git');
    expect(opts.threshold).toBe(360_000);
    expect(opts.outDir).toBe(process.cwd());
    expect(opts.compress).toBe(false);
    expect(opts.keepTmp).toBe(false);
  });

  it('全フラグを解釈する', () => {
    const opts = parseArgs([
      'git@github.com:o/r.git',
      '--threshold', '100000',
      '--out-dir', '/tmp/out',
      '--compress',
      '--keep-tmp',
    ]);
    expect(opts.gitUrl).toBe('git@github.com:o/r.git');
    expect(opts.threshold).toBe(100_000);
    expect(opts.outDir).toBe('/tmp/out');
    expect(opts.compress).toBe(true);
    expect(opts.keepTmp).toBe(true);
  });

  it('URL が無い場合は例外', () => {
    expect(() => parseArgs(['--compress'])).toThrow(/URL/);
  });

  it('--threshold が数値でない場合は例外', () => {
    expect(() => parseArgs(['https://github.com/o/r.git', '--threshold', 'abc']))
      .toThrow(/threshold/);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test -- tests/cli.test.ts`
Expected: FAIL（`src/cli.js` 未定義）

- [ ] **Step 3: 最小実装を書く**

`src/cli.ts`:

```ts
import { DEFAULT_THRESHOLD } from './constants.js';

export interface CliOptions {
  gitUrl: string;
  threshold: number;
  outDir: string;
  compress: boolean;
  keepTmp: boolean;
}

/** argv（実行ファイル/スクリプト名を除いた配列）を解釈する。 */
export const parseArgs = (argv: string[]): CliOptions => {
  let gitUrl: string | undefined;
  let threshold = DEFAULT_THRESHOLD;
  let outDir = process.cwd();
  let compress = false;
  let keepTmp = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--threshold': {
        const value = argv[++i];
        const n = Number(value);
        if (!Number.isFinite(n) || n <= 0) {
          throw new Error(`--threshold には正の数値を指定してください: ${value}`);
        }
        threshold = n;
        break;
      }
      case '--out-dir':
        outDir = argv[++i];
        break;
      case '--compress':
        compress = true;
        break;
      case '--keep-tmp':
        keepTmp = true;
        break;
      default:
        if (arg.startsWith('--')) {
          throw new Error(`未知のオプション: ${arg}`);
        }
        if (gitUrl === undefined) {
          gitUrl = arg;
        } else {
          throw new Error(`引数が多すぎます: ${arg}`);
        }
    }
  }

  if (gitUrl === undefined) {
    throw new Error('Git URL を指定してください。使用例: repomix-nlm <git-url> [--threshold n] [--out-dir path] [--compress] [--keep-tmp]');
  }

  return { gitUrl, threshold, outDir, compress, keepTmp };
};
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm test -- tests/cli.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/cli.ts tests/cli.test.ts
git commit -m "feat: add CLI argument parser"
```

---

## Task 7: Git ライフサイクル（git.ts）

**Files:**
- Create: `src/git.ts`
- Test: `tests/git.test.ts`（認証エラー判定の純粋関数のみ TDD。clone 実体は統合扱い）

- [ ] **Step 1: 失敗するテストを書く**

`tests/git.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isAuthError } from '../src/git.js';

describe('isAuthError', () => {
  it('認証系の stderr を検出する', () => {
    expect(isAuthError('fatal: Authentication failed for https://...')).toBe(true);
    expect(isAuthError('Permission denied (publickey).')).toBe(true);
    expect(isAuthError('could not read Username for https://github.com')).toBe(true);
  });
  it('認証以外のエラーは false', () => {
    expect(isAuthError('fatal: repository not found')).toBe(false);
    expect(isAuthError('')).toBe(false);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test -- tests/git.test.ts`
Expected: FAIL（`src/git.js` 未定義）

- [ ] **Step 3: 最小実装を書く**

`src/git.ts`:

```ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** git の stderr が認証起因かを判定する。 */
export const isAuthError = (stderr: string): boolean => {
  const patterns = [
    /authentication failed/i,
    /permission denied/i,
    /could not read username/i,
    /could not read password/i,
    /invalid username or password/i,
    /access denied/i,
  ];
  return patterns.some((re) => re.test(stderr));
};

/** リポジトリを shallow clone する。失敗時は認証判定付きで例外を投げる。 */
export const cloneRepo = async (gitUrl: string, destDir: string): Promise<void> => {
  try {
    await execFileAsync('git', ['clone', '--depth', '1', gitUrl, destDir]);
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr ?? '';
    if (isAuthError(stderr)) {
      throw new Error(
        'リポジトリの Clone に失敗しました（認証エラー）。認証情報の確認、または SSH キー/トークンの設定を確認してください。',
      );
    }
    throw new Error(`リポジトリの Clone に失敗しました: ${stderr || (error as Error).message}`);
  }
};

/** clone 済みディレクトリの現在ブランチ名を取得する。 */
export const getCurrentBranch = async (repoDir: string): Promise<string> => {
  const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: repoDir,
  });
  return stdout.trim();
};
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm test -- tests/git.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/git.ts tests/git.test.ts
git commit -m "feat: add git clone/branch helpers with auth error detection"
```

---

## Task 8: エントリーポイント統合（index.ts）

**Files:**
- Create: `src/index.ts`

> 全モジュールを束ねるオーケストレーション。副作用が大きいため自動テストはせず、Task 9 のスモークで検証する。

- [ ] **Step 1: `src/index.ts` を作成**

```ts
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
  const opts = parseArgs(process.argv.slice(2));
  const identity = parseGitUrl(opts.gitUrl);

  let tmpDir: string | undefined;
  try {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'repomix-nlm-'));
    const repoDir = path.join(tmpDir, 'repo');

    console.log(`Cloning ${opts.gitUrl} ...`);
    await cloneRepo(opts.gitUrl, repoDir);

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
      });
    }

    console.log(`Done. ${chunks.length} file(s) written to ${outDir}`);
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exitCode = 1;
  } finally {
    if (tmpDir && !opts.keepTmp) {
      await rm(tmpDir, { recursive: true, force: true });
    } else if (tmpDir) {
      console.log(`(--keep-tmp) tmp retained at: ${tmpDir}`);
    }
  }
};

void main();
```

- [ ] **Step 2: 型チェックを実行**

Run: `npm run typecheck`
Expected: エラーなし

- [ ] **Step 3: ビルドを実行**

Run: `npm run build`
Expected: `dist/` に各 `.js` が生成される

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: add CLI entry point orchestrating clone, chunking, and output"
```

---

## Task 9: Devcontainer とスモーク検証

**Files:**
- Create: `.devcontainer/devcontainer.json`
- Create: `.devcontainer/Dockerfile`

> 注: リポジトリ直下の `repomix/` クローンは独自の `.devcontainer/` を持つが、本ツールの devcontainer はプロジェクトルートに新規作成する。

- [ ] **Step 1: `.devcontainer/Dockerfile` を作成**

```dockerfile
FROM node:22-bookworm

# git は clone のために必須
RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
```

- [ ] **Step 2: `.devcontainer/devcontainer.json` を作成**

```json
{
  "name": "repomix-nlm-splitter",
  "build": {
    "dockerfile": "Dockerfile"
  },
  "postCreateCommand": "npm install",
  "customizations": {
    "vscode": {
      "extensions": ["dbaeumer.vscode-eslint"]
    }
  },
  "remoteUser": "node"
}
```

- [ ] **Step 3: 全テストを実行（devcontainer 内）**

Run: `npm test`
Expected: parser / chunker / repomixRunner / cli / git の全テストが PASS

- [ ] **Step 4: 型チェックとビルド**

Run: `npm run typecheck && npm run build`
Expected: エラーなし、`dist/` 生成

- [ ] **Step 5: 公開リポジトリでスモーク実行**

Run: `node dist/index.js https://github.com/sindresorhus/is.git --out-dir /tmp/smoke`
Expected:
- `/tmp/smoke/sindresorhus-is-main-YYYYMMDD/` が生成される
- 中に `.txt` ファイルが1つ以上あり、先頭が Repomix の XML 構造（`<file_summary>` 等のタグ）になっている
- 一時ディレクトリ（`os.tmpdir()/repomix-nlm-*`）が残っていない

- [ ] **Step 6: 出力内容を目視確認**

Run: `head -20 /tmp/smoke/sindresorhus-is-main-*/*.txt`
Expected: XML スタイル（`<file_summary>`, `<directory_structure>`, `<files>` 等のタグ）であること

- [ ] **Step 7: Commit**

```bash
git add .devcontainer/devcontainer.json .devcontainer/Dockerfile
git commit -m "chore: add devcontainer for Node 22 + git"
```

---

## Self-Review チェック結果

**1. Spec coverage（設計書の各要件 → タスク対応）:**
- URL解析・owner/repo抽出 → Task 3 ✅
- tmp 作成・shallow clone・ブランチ取得 → Task 7, 8 ✅
- 出力ディレクトリ名 `{owner}-{repo}-{branch}-{YYYYMMDD}` → Task 3, 8 ✅
- バイナリ拡張子除外・default/gitignore継承 → Task 2, 4b ✅
- 語数計算・貪欲ビンパッキング・巨大ファイル独立 → Task 4 ✅
- 共通親ディレクトリ→ハイフン連結ファイル名・衝突連番 → Task 4 ✅
- XMLスタイル・`.txt`拡張子維持 → Task 5 ✅
- compress フラグ（デフォルトOFF） → Task 5, 6, 8 ✅
- 認証エラーのアクション可能メッセージ → Task 7 ✅
- `finally` での確実なクリーンアップ → Task 8 ✅
- Devcontainer（Node 22 + git） → Task 9 ✅

**2. Placeholder scan:** TODO/TBD/曖昧指示なし。各コードステップに完全な実装を記載済み。

**3. Type consistency:** `FileEntry`/`Chunk`/`RepoIdentity`/`RunChunkOptions`/`CliOptions` を定義箇所と利用箇所で一致確認済み。`buildChunks` は `Chunk[]` を返し、`index.ts` で `chunk.name`/`chunk.files`/`chunk.words` を利用、`runChunk` の `RunChunkOptions` に整合。

**設計との差分（要周知）:** repomix の `engines.node >=22.0.0` のため、devcontainer は Node 20 ではなく **Node 22** を採用した。
