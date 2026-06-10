import { DEFAULT_THRESHOLD } from './constants.js';

export interface CliOptions {
  gitUrl: string;
  branch: string | undefined;
  threshold: number;
  outDir: string;
  compress: boolean;
  keepTmp: boolean;
  enableSecurityCheck: boolean;
}

/** argv（実行ファイル/スクリプト名を除いた配列）を解釈する。 */
export const parseArgs = (argv: string[]): CliOptions => {
  let gitUrl: string | undefined;
  let branch: string | undefined;
  let threshold = DEFAULT_THRESHOLD;
  let outDir = process.cwd();
  let compress = false;
  let keepTmp = false;
  let enableSecurityCheck = true;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--branch': {
        const value = argv[++i];
        if (!value || value.startsWith('--')) {
          throw new Error(`--branch にはブランチ名を指定してください: ${value ?? '(値なし)'}`);
        }
        branch = value;
        break;
      }
      case '--threshold': {
        const value = argv[++i];
        const n = Number(value);
        if (!Number.isFinite(n) || n <= 0) {
          throw new Error(`--threshold には正の数値を指定してください: ${value}`);
        }
        threshold = n;
        break;
      }
      case '--out-dir': {
        const value = argv[++i];
        if (!value || value.startsWith('--')) {
          throw new Error(`--out-dir にはパスを指定してください: ${value ?? '(値なし)'}`);
        }
        outDir = value;
        break;
      }
      case '--compress':
        compress = true;
        break;
      case '--keep-tmp':
        keepTmp = true;
        break;
      case '--enable-security':
        enableSecurityCheck = true;
        break;
      case '--no-enable-security':
        enableSecurityCheck = false;
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
    throw new Error('Git URL を指定してください。使用例: repomix-nlm <git-url> [--branch name] [--threshold n] [--out-dir path] [--compress] [--keep-tmp]');
  }

  return { gitUrl, branch, threshold, outDir, compress, keepTmp, enableSecurityCheck };
};
