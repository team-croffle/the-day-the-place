import { memberChangeRefusal } from './member-change';

const admin = {
  actorId: 'admin-1',
  targetId: 'member-1',
  targetRole: 'member' as const,
  adminCount: 1,
};

describe('member change', () => {
  it('allows a name-only update of the signed-in admin', () => {
    expect(
      memberChangeRefusal({
        ...admin,
        targetId: 'admin-1',
        targetRole: 'admin',
        action: 'update',
      }),
    ).toBeNull();
  });

  it('refuses letting an admin change their own role', () => {
    expect(
      memberChangeRefusal({
        ...admin,
        targetId: 'admin-1',
        targetRole: 'admin',
        nextRole: 'member',
        action: 'update',
      }),
    ).toBe('self-role');
  });

  it('allows promoting another member', () => {
    expect(
      memberChangeRefusal({
        ...admin,
        nextRole: 'admin',
        action: 'update',
      }),
    ).toBeNull();
  });

  it('allows demoting another admin when one remains', () => {
    expect(
      memberChangeRefusal({
        ...admin,
        targetId: 'admin-2',
        targetRole: 'admin',
        nextRole: 'member',
        adminCount: 2,
        action: 'update',
      }),
    ).toBeNull();
  });

  it('refuses demoting the last admin', () => {
    expect(
      memberChangeRefusal({
        ...admin,
        targetId: 'admin-2',
        targetRole: 'admin',
        nextRole: 'member',
        adminCount: 1,
        action: 'update',
      }),
    ).toBe('last-admin');
  });

  it('refuses deleting the signed-in admin', () => {
    expect(
      memberChangeRefusal({
        ...admin,
        targetId: 'admin-1',
        targetRole: 'admin',
        action: 'delete',
      }),
    ).toBe('self-delete');
  });

  it('allows deleting another member', () => {
    expect(memberChangeRefusal({ ...admin, action: 'delete' })).toBeNull();
  });

  it('refuses deleting the last admin', () => {
    expect(
      memberChangeRefusal({
        ...admin,
        targetId: 'admin-2',
        targetRole: 'admin',
        adminCount: 1,
        action: 'delete',
      }),
    ).toBe('last-admin');
  });
});
