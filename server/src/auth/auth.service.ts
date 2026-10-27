import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

import { DRIZZLE } from '../database/database.constants';
import type { DrizzleDb } from '../database/database.module';
import { accounts, sessions, users, verifications } from '../database/schema';
import { sendAuthMail } from './send-auth-mail';

function trustedOrigins(corsOrigin: string | undefined): string[] {
  const local = ['http://localhost:5173', 'http://localhost:3000'];
  if (!corsOrigin || corsOrigin === '*') return local;
  return [...new Set([corsOrigin, ...local])];
}

@Injectable()
export class AuthService {
  readonly auth;

  constructor(@Inject(DRIZZLE) db: DrizzleDb, config: ConfigService) {
    const secret = config.get<string>('BETTER_AUTH_SECRET');
    if (!secret) {
      throw new Error('BETTER_AUTH_SECRET is required');
    }

    const resendKey = config.get<string>('RESEND_API_KEY');
    if (!resendKey) {
      throw new Error('RESEND_API_KEY is required');
    }
    const from = config.get<string>('RESEND_FROM') ?? 'onboarding@resend.dev';
    const corsOrigin = config.get<string>('CORS_ORIGIN');
    const crossSite = Boolean(corsOrigin?.startsWith('https://'));

    const send = (to: string, subject: string, text: string) =>
      sendAuthMail({ apiKey: resendKey, from, to, subject, text });

    this.auth = betterAuth({
      secret,
      baseURL: config.get<string>('BETTER_AUTH_URL') ?? 'http://localhost:3000',
      trustedOrigins: trustedOrigins(corsOrigin),
      emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
        sendResetPassword: async ({ user, url }) => {
          await send(
            user.email,
            '비밀번호 재설정',
            `비밀번호를 재설정하려면 이 링크를 여세요.\n${url}`,
          );
        },
      },
      emailVerification: {
        sendOnSignUp: true,
        sendOnSignIn: true,
        autoSignInAfterVerification: true,
        sendVerificationEmail: async ({ user, url }) => {
          await send(user.email, '이메일 인증', `가입을 마치려면 이 링크를 여세요.\n${url}`);
        },
      },
      user: {
        additionalFields: {
          role: {
            type: 'string',
            required: true,
            defaultValue: 'member',
            input: false,
          },
        },
      },
      database: drizzleAdapter(db, {
        provider: 'pg',
        schema: {
          user: users,
          session: sessions,
          account: accounts,
          verification: verifications,
        },
      }),
      advanced: {
        database: { generateId: 'uuid' },
        defaultCookieAttributes: crossSite
          ? { sameSite: 'none', secure: true }
          : { sameSite: 'lax', secure: false },
      },
    });
  }
}
