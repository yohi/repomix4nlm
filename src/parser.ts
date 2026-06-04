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
