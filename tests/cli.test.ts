import { describe, expect, it } from 'vitest';
import { parseArgs } from '../src/cli.js';

describe('parseArgs', () => {
  it('URL のみ（デフォルト値）', () => {
    const opts = parseArgs(['https://github.com/o/r.git']);
    expect(opts.gitUrl).toBe('https://github.com/o/r.git');
    expect(opts.threshold).toBe(360_000);
    expect(opts.outDir).toBe(process.cwd());
    expect(opts.compress).toBe(false);
    expect(opts.keepTmp).toBe(false);
  });

  it('全フラグを解釈する', () => {
    const opts = parseArgs([
      'git@github.com:o/r.git',
      '--threshold', '100000',
      '--out-dir', '/tmp/out',
      '--compress',
      '--keep-tmp',
    ]);
    expect(opts.gitUrl).toBe('git@github.com:o/r.git');
    expect(opts.threshold).toBe(100_000);
    expect(opts.outDir).toBe('/tmp/out');
    expect(opts.compress).toBe(true);
    expect(opts.keepTmp).toBe(true);
  });

  it('URL が無い場合は例外', () => {
    expect(() => parseArgs(['--compress'])).toThrow(/URL/);
  });

  it('--threshold が数値でない場合は例外', () => {
    expect(() => parseArgs(['https://github.com/o/r.git', '--threshold', 'abc']))
      .toThrow(/threshold/);
  });
});
