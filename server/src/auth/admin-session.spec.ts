import { adminSessionDecision } from './admin-session';

describe('admin session', () => {
  it('rejects a missing session', () => {
    expect(adminSessionDecision(null)).toBe('unauthorized');
  });

  it('rejects a member session', () => {
    expect(adminSessionDecision({ role: 'member' })).toBe('forbidden');
  });

  it('accepts an admin session', () => {
    expect(adminSessionDecision({ role: 'admin' })).toBe('allow');
  });
});
