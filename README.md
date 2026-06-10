# Repomix NotebookLM 分割ラッパー (`repomix4nlm`)

大規模なGitリポジトリを自動的に Clone し、NotebookLM の単語数制限（約 500,000 語）の安全圏に収まるよう、ディレクトリの階層構造を尊重してインテリジェントにチャンク分割し、Repomix の **XML スタイル** で **`.txt` ファイル** として構造化出力する CLI ラッパーツールです。

## 概要

大規模リポジトリをそのまま AI や NotebookLM に読み込ませようとすると、コンテキスト制限をオーバーしてしまいます。本ツールは、以下の特徴を持ってリポジトリを適切なサイズの XML 文書（`.txt` 拡張子）に分割出力します。

- **ディレクトリ階層の尊重**: 同一ディレクトリのファイルができるだけ同じチャンクに収まるようにソート・パッキングします。
- **ファイル単位の精密制御**: Repomix の `pack()` API の `explicitFiles` を用い、必要なファイルのみを漏れなくチャンク化します。
- **安全マージン**: デフォルトの語数閾値は XML オーバーヘッドを考慮した 360,000 語（安全圏）に設定されています。
- **一時クローンの自動削除**: クローンした一時ディレクトリは、処理が成功・失敗したかを問わず `finally` ブロックで確実にクリーンアップされます。
- **セキュアな設計**: 認証エラー時にはSSHキーやトークンの設定を確認するよう丁寧な案内を出力し、デフォルトで Repomix のセキュリティスキャンが機能します。

## 必要条件

- **Node.js**: >= 22.0.0 （Repomix の要求仕様）
- **Git**: CLI から実行可能であること

## インストールと準備

```bash
# 依存パッケージのインストール
npm install

# ビルド
npm run build
```

## 使い方

### 基本実行

ローカルでビルドして実行する、あるいは `npx` を用いて直接実行できます。

```bash
# ソースから直接実行（開発用）
npx tsx src/index.ts <git-url> [options]

# ビルド済みバイナリを実行
node dist/index.js <git-url> [options]

# インストールしたパッケージとして実行する場合
npx @yohi/repomix4nlm <git-url> [options]
```

### コマンドラインオプション

| オプション | 説明 | デフォルト値 |
|---|---|---|
| `--branch <name>` | clone するブランチ名を指定する | リポジトリのデフォルトブランチ |
| `--threshold <n>` | チャンクの実効語数上限（空白/改行 split 基準） | `360000` |
| `--out-dir <path>` | 出力ディレクトリの保存先となる親ディレクトリ | カレントディレクトリ (`process.cwd()`) |
| `--compress` | Tree-sitter を用いてシグネチャのみ抽出し、コードの語数を削減する | OFF |
| `--keep-tmp` | デバッグ用に、処理終了後も一時クローンディレクトリを削除せずに保持する | OFF |
| `--no-enable-security` | 実行時のセキュリティスキャンを無効化する | スキャン有効 |

### オプション利用例

#### 1. 出力先と上限語数の指定（基本）
語数上限を `300,000語` に制限し、出力先を `./output` ディレクトリに指定して実行します。
```bash
node dist/index.js https://github.com/yohi/repomix4nlm.git --out-dir ./output --threshold 300000
```

#### 2. ブランチの指定 (`--branch`)
デフォルトブランチ以外のブランチを解析したい場合に指定します。
```bash
node dist/index.js https://github.com/yohi/repomix4nlm.git --out-dir ./output --branch develop
```

#### 3. Tree-sitter 圧縮の有効化 (`--compress`)
大規模リポジトリなどでコードの構造（シグネチャ）のみを抽出し、語数を大幅に削減してパッキングしたい場合に指定します。
```bash
node dist/index.js https://github.com/yohi/repomix4nlm.git --out-dir ./output --compress
```

#### 4. セキュリティスキャンを無効化 (`--no-enable-security`)
信頼できるプライベートリポジトリなどで、セキュリティスキャンのオーバーヘッドを回避して高速に処理したい場合に指定します。
```bash
node dist/index.js https://github.com/yohi/repomix4nlm.git --out-dir ./output --no-enable-security
```

#### 5. デバッグ用：一時ファイルを保持 (`--keep-tmp`)
クローンしたリポジトリの内容やチャンクパッキング処理の途中経過をデバッグするために、実行後も一時クローンディレクトリを削除せず残します。
```bash
node dist/index.js https://github.com/yohi/repomix4nlm.git --out-dir ./output --keep-tmp
```

#### 6. 複数オプションの組み合わせ
`develop` ブランチを対象に、上限語数を `250,000語` にしつつ、Tree-sitter 圧縮を有効にし、セキュリティチェックをスキップする例です。
```bash
node dist/index.js https://github.com/yohi/repomix4nlm.git --out-dir ./output --branch develop --threshold 250000 --compress --no-enable-security
```

実行が完了すると、指定した出力ディレクトリに `{owner}-{repo}-{branch}-{YYYYMMDD}` 形式のディレクトリが生成され、その中に `src-core.txt` や `src-utils.txt` などの XML 形式ファイルが出力されます。

## 開発とテスト

本プロジェクトは TypeScript (ESM) で実装されており、テストフレームワークとして `vitest` を採用しています。

```bash
# 全テストの実行
npm test

# 型チェック
npm run typecheck
```
