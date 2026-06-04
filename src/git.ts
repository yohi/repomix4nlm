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
