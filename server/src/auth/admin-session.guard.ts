import type { IncomingHttpHeaders } from 'node:http';

import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';

import { adminSessionDecision } from './admin-session';
import { AuthService } from './auth.service';

@Injectable()
export class AdminSessionGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: IncomingHttpHeaders }>();
    const session = await this.authService.auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });
    const decision = adminSessionDecision(session ? { role: session.user.role } : null);
    if (decision === 'unauthorized') throw new UnauthorizedException();
    if (decision === 'forbidden') throw new ForbiddenException();
    return true;
  }
}
