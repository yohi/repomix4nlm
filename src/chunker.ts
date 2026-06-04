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
