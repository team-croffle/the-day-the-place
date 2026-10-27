import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth/auth.module';
import { CollectorModule } from './collector/collector.module';
import { DatabaseModule } from './database/database.module';
import { ExhibitionsModule } from './exhibitions/exhibitions.module';
import { HealthModule } from './health/health.module';
import { PlacesModule } from './places/places.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env'],
      expandVariables: true,
    }),
    DatabaseModule,
    AuthModule,
    HealthModule,
    PlacesModule,
    ExhibitionsModule,
    CollectorModule,
    UsersModule,
  ],
})
export class AppModule {}
