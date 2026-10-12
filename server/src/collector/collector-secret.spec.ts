import { collectorSecretMatches } from './collector-secret';

describe('collector secret', () => {
  it('rejects an empty configured secret', () => {
    expect(collectorSecretMatches('', 'anything')).toBe(false);
  });

  it('rejects a different secret', () => {
    expect(collectorSecretMatches('expected-secret', 'other-secret')).toBe(false);
  });

  it('accepts the same secret', () => {
    expect(collectorSecretMatches('expected-secret', 'expected-secret')).toBe(true);
  });
});
