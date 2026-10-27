export const USER_ROLES = ['admin', 'member'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

/** 사용자 생성 페이로드. 역할은 받지 않고 가입은 member 다. */
export interface CreateUserPayload {
  email: string;
  name: string;
}

/** 역할 변경은 관리자 세션의 수정에서만 받는다. */
export interface UpdateUserPayload {
  email?: string;
  name?: string;
  role?: UserRole;
}
