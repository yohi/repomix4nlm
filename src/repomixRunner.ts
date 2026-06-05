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
  /** セキュリティスキャンの有無（デフォルト true）。 */
  enableSecurityCheck?: boolean;
}

/** チャンク用のマージ済み Repomix 設定を構築する。 */
export const buildChunkConfig = (opts: RunChunkOptions): ReturnType<typeof mergeConfigs> =>
  mergeConfigs(
    opts.rootDir,
    {
      output: {
        // filePath を明示指定 → xml スタイルでも .txt が維持される
        filePath: path.resolve(opts.outDir, `${opts.chunkName}.txt`),
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
        enableSecurityCheck:
          typeof opts.enableSecurityCheck === 'boolean'
            ? opts.enableSecurityCheck
            : true,
      },
    },
    {},
  );

type PackFn = typeof pack;

/** 1チャンクを XML スタイルの .txt として書き出す。 */
export const runChunk = async (opts: RunChunkOptions, packFn: PackFn = pack): Promise<void> => {
  const config = buildChunkConfig(opts);
  const absoluteFiles = opts.files.map((f) => path.resolve(opts.rootDir, f));
  await packFn([opts.rootDir], config, () => {}, {}, absoluteFiles);
};
