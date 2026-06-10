import { describe, expect, it } from 'vitest';
import { parseArgs } from '../src/cli.js';

describe('parseArgs', () => {
  it('URL のみ（デフォルト値）', () => {
    const opts = parseArgs(['https://github.com/o/r.git']);
    expect(opts.gitUrl).toBe('https://github.com/o/r.git');
    expect(opts.branch).toBeUndefined();
    expect(opts.threshold).toBe(360_000);
    expect(opts.outDir).toBe(process.cwd());
    expect(opts.compress).toBe(false);
    expect(opts.keepTmp).toBe(false);
    expect(opts.enableSecurityCheck).toBe(true);
  });

  it('全フラグを解釈する', () => {
    const opts = parseArgs([
      'git@github.com:o/r.git',
      '--branch', 'develop',
      '--threshold', '100000',
      '--out-dir', '/tmp/out',
      '--compress',
      '--keep-tmp',
      '--no-enable-security',
    ]);
    expect(opts.gitUrl).toBe('git@github.com:o/r.git');
    expect(opts.branch).toBe('develop');
    expect(opts.threshold).toBe(100_000);
    expect(opts.outDir).toBe('/tmp/out');
    expect(opts.compress).toBe(true);
    expect(opts.keepTmp).toBe(true);
    expect(opts.enableSecurityCheck).toBe(false);
  });

  it('URL が無い場合は例外', () => {
    expect(() => parseArgs(['--compress'])).toThrow(/URL/);
  });

  it('--threshold が数値でない場合は例外', () => {
    expect(() => parseArgs(['https://github.com/o/r.git', '--threshold', 'abc']))
      .toThrow(/threshold/);
  });

  it('--out-dir の値が欠落している場合は例外', () => {
    expect(() => parseArgs(['https://github.com/o/r.git', '--out-dir'])).toThrow(/out-dir/);
  });

  it('--out-dir の値が別のフラグの場合は例外', () => {
    expect(() => parseArgs(['https://github.com/o/r.git', '--out-dir', '--compress'])).toThrow(/out-dir/);
  });

  it('--enable-security は明示的に有効化できる', () => {
    const opts = parseArgs(['https://github.com/o/r.git', '--no-enable-security', '--enable-security']);
    expect(opts.enableSecurityCheck).toBe(true);
  });

  it('--branch でブランチ名を指定できる', () => {
    const opts = parseArgs(['https://github.com/o/r.git', '--branch', 'feature/foo']);
    expect(opts.branch).toBe('feature/foo');
  });

  it('--branch の値が欠落している場合は例外', () => {
    expect(() => parseArgs(['https://github.com/o/r.git', '--branch'])).toThrow(/branch/);
  });

  it('--branch の値が別のフラグの場合は例外', () => {
    expect(() => parseArgs(['https://github.com/o/r.git', '--branch', '--compress'])).toThrow(/branch/);
  });
});
