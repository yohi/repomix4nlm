import { describe, expect, it } from 'vitest';
import { isAuthError } from '../src/git.js';

describe('isAuthError', () => {
  it('認証系の stderr を検出する', () => {
    expect(isAuthError('fatal: Authentication failed for https://...')).toBe(true);
    expect(isAuthError('Permission denied (publickey).')).toBe(true);
    expect(isAuthError('could not read Username for https://github.com')).toBe(true);
  });
  it('認証以外のエラーは false', () => {
    expect(isAuthError('fatal: repository not found')).toBe(false);
    expect(isAuthError('')).toBe(false);
  });
});
