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
