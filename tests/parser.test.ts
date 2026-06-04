import { describe, expect, it } from 'vitest';
import { buildOutputDirName, formatDate, parseGitUrl, sanitizeSegment } from '../src/parser.js';

describe('parseGitUrl', () => {
  it('HTTPS GitHub URL から owner/repo を抽出する', () => {
    expect(parseGitUrl('https://github.com/yamadashy/repomix.git')).toEqual({
      owner: 'yamadashy',
      repo: 'repomix',
    });
  });

  it('SSH GitHub URL から owner/repo を抽出する', () => {
    expect(parseGitUrl('git@github.com:yamadashy/repomix.git')).toEqual({
      owner: 'yamadashy',
      repo: 'repomix',
    });
  });

  it('Bitbucket HTTPS URL から owner/repo を抽出する', () => {
    expect(parseGitUrl('https://bitbucket.org/team/project.git')).toEqual({
      owner: 'team',
      repo: 'project',
    });
  });

  it('owner/repo を抽出できない場合は例外を投げる', () => {
    expect(() => parseGitUrl('not-a-url')).toThrow(/owner\/repo/);
  });
});

describe('formatDate', () => {
  it('YYYYMMDD 形式にゼロ埋めして整形する', () => {
    expect(formatDate(new Date(2026, 4, 9))).toBe('20260509'); // 5月9日
  });
});

describe('sanitizeSegment', () => {
  it('スラッシュをハイフンに、不正文字をハイフンに置換する', () => {
    expect(sanitizeSegment('feature/new-thing')).toBe('feature-new-thing');
    expect(sanitizeSegment('a b@c')).toBe('a-b-c');
  });
});

describe('buildOutputDirName', () => {
  it('owner-repo-branch-YYYYMMDD を生成する', () => {
    const name = buildOutputDirName(
      { owner: 'yamadashy', repo: 'repomix' },
      'main',
      new Date(2026, 4, 29),
    );
    expect(name).toBe('yamadashy-repomix-main-20260529');
  });

  it('ブランチ名のスラッシュをハイフン化する', () => {
    const name = buildOutputDirName(
      { owner: 'o', repo: 'r' },
      'feature/x',
      new Date(2026, 0, 1),
    );
    expect(name).toBe('o-r-feature-x-20260101');
  });
});
