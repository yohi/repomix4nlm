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
