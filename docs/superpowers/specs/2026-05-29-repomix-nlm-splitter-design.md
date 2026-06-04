# 設計書: Repomix NotebookLM 分割ラッパー (`repomix-nlm-splitter`)

- 作成日: 2026-05-29
- ステータス: 設計確定（実装前）
- 対象: 大規模Gitリポジトリを Clone し、NotebookLM の語数制限内に収まるよう
  ディレクトリ/ファイル単位でチャンク分割して Repomix の XML スタイルで `.txt` 出力するラッパーCLI

## 1. 目的とスコープ

大規模なGitリポジトリ（GitHub / Bitbucket 等）を自動 Clone し、NotebookLM の単語数制限
（約 500,000 語）の安全圏に収まるよう、ディレクトリの階層構造を尊重してインテリジェントに
チャンク分割する。各チャンクは Repomix の **XML スタイル**で処理し、指定の命名規則に従って
**`.txt` ファイル**として構造化出力ディレクトリへ保存する。

### 確定した設計判断

| 論点 | 決定 |
|---|---|
| Repomix 呼び出し方式 | `pack()` 公開API をプロセス内呼び出し（第5引数 `explicitFiles` にチャンクのファイルリストを渡す） |
| 語数予算の基準 | ソース内容の生語数 + 安全マージン。実効閾値 = 360,000 語（= 400,000 の 90%、XMLオーバーヘッド吸収） |
| 分割粒度 | 貪欲ビンパッキング + 同一主要ディレクトリが跨る場合 `chunkN` 連番 |
| 圧縮/削減 | `--compress` を CLI フラグ化（デフォルト OFF）。指定時のみ `output.compress: true` |

## 2. アーキテクチャ概要とデータフロー

```text
入力: <git-url> [--threshold 360000] [--out-dir .] [--compress] [--keep-tmp]
   │
   ▼
[1] parser.ts   ─ Git URL解析 → owner / repo 抽出、出力ディレクトリ名の素材生成（純粋関数）
   │
   ▼
[2] index.ts    ─ os.tmpdir() に一意tmp作成 → git clone（shallow: --depth 1）
   │              → git rev-parse --abbrev-ref HEAD でブランチ取得
   │              → 出力dir名確定: {owner}-{repo}-{branch}-{YYYYMMDD}
   │
   ▼
[3] chunker.ts  ─ repomix searchFiles() で対象ファイル列挙
   │              （useGitignore / useDefaultPatterns 継承 + バイナリ拡張子を customPatterns で除外）
   │              → 各ファイルの語数を算出（空白/改行 split）
   │              → ディレクトリ階層順に貪欲ビンパッキング → Chunk[]
   │
   ▼
[4] repomixRunner.ts ─ Chunk ごとに pack(rootDirs, mergedConfig, _, _, explicitFiles)
   │                    config: style=xml, filePath=<out>/<dir-hyphen>.txt
   │                    → .txt（中身は XML）を出力dirへ書き出し
   │
   ▼
[5] index.ts (finally) ─ tmpディレクトリを必ず削除（fs.rm recursive,force）
```

### 設計の核

Repomix の `pack(rootDirs, config, progressCallback, overrideDeps, explicitFiles, options)` の
第5引数 `explicitFiles` にチャンクのファイルリストを渡すことで、**ファイル単位の精密制御**を実現する。
`searchFiles()` は Repomix 標準の除外ロジック（`useDefaultPatterns`=node_modules/.git/dist 等、
`useGitignore`）を継承するため、除外ロジックの二重実装を避けられる。バイナリ/アセット拡張子は
`ignore.customPatterns` に `**/*.svg` 形式で追加し完全除外する。

### 責務分離

- `parser.ts`: 純粋関数群（URL→owner/repo、日付生成、ディレクトリ名サニタイズ）。副作用なし＝単体テスト容易。
- `chunker.ts`: ファイル列挙 + 語数計算 + ビンパッキング + 命名。`Chunk[]` を返す純粋寄りロジック。
- `repomixRunner.ts`: Repomix `pack()` 呼び出しと config 構築のアダプタ。
- `index.ts`: CLI・Git ライフサイクル・tmp 管理（オーケストレーション）。
- `constants.ts`: `THRESHOLD`, `BINARY_EXCLUDES` 等の定数。

## 3. チャンク分割アルゴリズムと命名規則

### 3.1 ソート

全対象ファイルを Repomix の `sortPaths()` 相当（ディレクトリ階層順・パス辞書順）に並べる。
これにより同一ディレクトリのファイルが隣接し、チャンクが階層構造を尊重する。

### 3.2 貪欲ビンパッキング

```text
THRESHOLD = 360,000 語（= 400,000 の 90%、XMLオーバーヘッド安全マージン。--threshold で変更可）

current = { files: [], words: 0 }
for file in sortedFiles:
    fw = wordCount(file)              # 空白/改行 split による概算語数

    # エッジケース: 単一ファイルが閾値超
    if fw > THRESHOLD:
        flush(current)               # 現チャンクを確定
        emit oversizedChunk([file])  # この巨大ファイル単独で1チャンク（例外にしない）
        continue

    # 通常: 加えると超過 → 現チャンクを確定して新規開始
    if current.words + fw > THRESHOLD and current.files not empty:
        flush(current)
        current = newChunk()

    current.files.push(file)
    current.words += fw
flush(current)                       # 最後のチャンク
```

### 3.3 ファイル名の決定（ディレクトリ名のハイフン連結）

各チャンクの「主要ディレクトリ」を、チャンク内ファイルの**共通親ディレクトリ（common path prefix）**
として求め、パス区切り `/` を `-` に置換する。

| ケース | チャンク内容 | 出力ファイル名 |
|---|---|---|
| 共通親が `src/core/metrics` | そのディレクトリ配下のみ | `src-core-metrics.txt` |
| 共通親が `src`（複数サブディレクトリ混在） | `src/a/...`, `src/b/...` | `src.txt` |
| ルート直下ファイル | `README.md`, `package.json` | `root.txt` |
| 同一共通親が複数チャンクに跨る（閾値超で分割） | — | `src-components-Home-chunk1.txt`, `...-chunk2.txt` |
| 単一巨大ファイル | `dist/bundle.js` 単独 | `dist-bundle.js.txt`（ファイル名もハイフン化） |

**衝突回避**: 生成済みファイル名を `Set` で管理。同名が出たら自動で `-chunk1`, `-chunk2` …
サフィックスを連番付与する。サニタイズで英数字・ハイフン・ドット以外は安全文字へ正規化する。

### 3.4 除外拡張子（`ignore.customPatterns` へ注入）

```text
画像/アイコン: svg, png, jpg, jpeg, gif, ico, webp, bmp
ドキュメント: pdf
アーカイブ:   zip, tar, gz, tar.gz, tgz, rar, 7z
フォント:     woff, woff2, ttf, eot
メディア:     mp4, mov, mp3, wav
（任意）:     *.min.js, *.min.css, *.lock
→ 各々 **/*.<ext> 形式で customPatterns へ
```

加えて Repomix の `useDefaultPatterns: true`（node_modules, .git, dist 等）と
`useGitignore: true` を併用する。

## 4. Repomix Config 構築（repomixRunner.ts）

`mergeConfigs(cwd, fileConfig, cliConfig)` を使用してマージ済み config を生成する。

```ts
const merged = mergeConfigs(tmpRepoDir, {
  output: {
    filePath: path.join(absOutDir, `${chunkName}.txt`), // 明示指定 → xmlでも .txt 維持
    style: 'xml',
    fileSummary: true,
    directoryStructure: true,
    copyToClipboard: false,
    compress: options.compress,        // --compress 指定時のみ true
  },
  ignore: {
    customPatterns: BINARY_EXCLUDES,
    useDefaultPatterns: true,
    useGitignore: true,
  },
  security: { enableSecurityCheck: false }, // 速度優先（任意で true 化可能）
}, {});

await pack([tmpRepoDir], merged, () => {}, {}, chunk.files);
```

**検証済み事実**: `output.filePath` を明示指定すると `mergeConfigs` の自動拡張子調整
（`configLoad.ts` の `filePathExplicitlySet` 分岐）が走らないため、`style: 'xml'` でも
`.txt` 拡張子が保持される。

**compress 有効時の注意**: チャンカは生語数で閾値判定するため、`--compress` 時は実出力
（シグネチャのみ）より語数を過大評価し、本来1チャンクで収まる量が複数チャンクに分かれる
（＝安全側の過分割）。これは許容する。

## 5. エラーハンドリング契約

| 失敗 | 挙動 |
|---|---|
| Clone失敗（認証/到達不可） | stderr を検査し、認証系なら「認証情報の確認、またはSSHキー/トークンの設定を確認してください」を明示出力。exit 1。 |
| 不正な Git URL | パース失敗メッセージ + 使用例を出力。exit 1。 |
| いずれかのチャンクで pack 失敗 | 当該チャンク名とエラーを出力し処理中断。exit 1。 |
| 正常/異常いずれも | **`finally` で tmp ディレクトリを `fs.rm(tmp, {recursive:true, force:true})` で確実に削除**（`--keep-tmp` 指定時を除く）。 |

## 6. CLI インターフェース

```
repomix-nlm <git-url> [options]

Options:
  --threshold <n>    チャンクの実効語数上限（デフォルト 360000）
  --out-dir <path>   出力先の親ディレクトリ（デフォルト カレント）
  --compress         Tree-sitter でシグネチャのみ抽出し語数を削減（デフォルト OFF）
  --keep-tmp         デバッグ用に tmp クローンを削除しない
```

## 7. テスト戦略（TDD、Devcontainer 内で `vitest` 実行）

- `parser.test.ts`: URL解析（GitHub / Bitbucket / SSH / HTTPS 各形式）、ディレクトリ名生成、
  日付は注入して固定。
- `chunker.test.ts`: 語数計算、ビンパッキング境界、巨大ファイル独立、共通親→ファイル名、
  名前衝突連番。**純粋ロジックの中核 → TDD を厚く**。
- `repomixRunner`: Repomix `pack` をモック注入し config 構築のみ検証（XML/`.txt`/除外/compress 反映）。
- Git / clone は実ネットワーク依存のため統合扱い。E2E は任意・スモークのみ。

## 8. プロジェクト・ファイルツリー

配置先 = プロジェクトルート `repomix7nlm/`。`repomix/` クローンはリファレンスとして併存。

```
repomix7nlm/
├── .devcontainer/
│   ├── devcontainer.json     # Node 22 + Git, postCreate: npm install
│   └── Dockerfile            # node:22-bookworm + git
├── src/
│   ├── index.ts              # CLI / Git制御 / tmp ライフサイクル
│   ├── parser.ts             # URL解析・出力dir名・日付（純粋関数）
│   ├── chunker.ts            # 列挙・語数・ビンパッキング・命名
│   ├── repomixRunner.ts      # pack() ラッパー・config 構築
│   └── constants.ts          # THRESHOLD, BINARY_EXCLUDES
├── tests/
│   ├── parser.test.ts
│   └── chunker.test.ts
├── package.json              # type:module, deps: repomix / devDeps: vitest, typescript, tsx
├── tsconfig.json             # ESNext / NodeNext / strict
└── docs/superpowers/specs/2026-05-29-repomix-nlm-splitter-design.md
```

## 9. 依存パッケージ

- `repomix`: `pack` / `searchFiles` / `mergeConfigs` / `sortPaths` を提供（本ツールの中核依存）。
- URL 解析: 外部依存を追加せず、Repomix の `parseRemoteValue` 流用または軽量自前正規表現で実装（依存削減）。
- dev: `vitest`, `typescript`, `tsx`。

## 10. Devcontainer 実行制約

テスト・依存解決・静的解析（Linter/Formatter）は、**必ず `.devcontainer` 環境内部で完結**させて
実行する。Git 操作（commit/push 等）はホスト側で行う。
