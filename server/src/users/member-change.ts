import type { UserRole } from '@nest-vue/shared';

export type MemberChangeRefusal = 'self-role' | 'self-delete' | 'last-admin';

/** 관리자가 회원을 고칠 때 거절할 경우. 자기 역할과 마지막 관리자는 내리지 않는다. */
export function memberChangeRefusal(input: {
  actorId: string;
  targetId: string;
  targetRole: UserRole;
  nextRole?: UserRole;
  adminCount: number;
  action: 'update' | 'delete';
}): MemberChangeRefusal | null {
  if (input.action === 'delete') {
    if (input.actorId === input.targetId) return 'self-delete';
    if (input.targetRole === 'admin' && input.adminCount <= 1) return 'last-admin';
    return null;
  }

  if (input.nextRole && input.nextRole !== input.targetRole && input.actorId === input.targetId) {
    return 'self-role';
  }

  if (input.targetRole === 'admin' && input.nextRole === 'member' && input.adminCount <= 1) {
    return 'last-admin';
  }

  return null;
}
