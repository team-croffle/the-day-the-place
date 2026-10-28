import type { IncomingHttpHeaders } from 'node:http';

import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';

import { AuthService } from './auth.service';

export interface SessionRequest {
  headers: IncomingHttpHeaders;
  sessionUserId?: string;
}

@Injectable()
export class SessionUserGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    const session = await this.authService.auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });
    if (!session?.user.id) throw new UnauthorizedException();
    request.sessionUserId = session.user.id;
    return true;
  }
}
