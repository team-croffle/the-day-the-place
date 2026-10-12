import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { collectorSecretMatches } from './collector-secret';

@Injectable()
export class CollectorSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('COLLECTOR_INGEST_SECRET', '').trim();
    const request = context
      .switchToHttp()
      .getRequest<{ header: (name: string) => string | undefined }>();
    const given = request.header('x-collector-secret') ?? '';
    if (!collectorSecretMatches(expected, given)) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
