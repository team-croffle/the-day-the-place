import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { CollectorModule } from './collector/collector.module';
import { DatabaseModule } from './database/database.module';
import { ExhibitionsModule } from './exhibitions/exhibitions.module';
import { FavoritesModule } from './favorites/favorites.module';
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
    AdminModule,
    HealthModule,
    PlacesModule,
    ExhibitionsModule,
    FavoritesModule,
    CollectorModule,
    UsersModule,
  ],
})
export class AppModule {}
