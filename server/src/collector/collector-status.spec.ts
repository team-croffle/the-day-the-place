import { collectorStatus } from './collector-status';

describe('collector status', () => {
  it('keeps counts and drops pending posts and secrets', () => {
    const status = collectorStatus({
      museumOr: 12,
      museumnews: 40,
      pendingCount: 2,
      exhibitionCount: 7,
      pending: [{ url: 'https://example.test/post', title: 'hidden' }],
      secret: 'ingest-secret',
    });

    expect(status).toEqual({
      museumOr: 12,
      museumnews: 40,
      pendingCount: 2,
      exhibitionCount: 7,
    });
    expect(JSON.stringify(status)).not.toContain('ingest-secret');
    expect(JSON.stringify(status)).not.toContain('example.test');
  });
});
