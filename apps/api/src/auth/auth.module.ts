import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { SystemRolesGuard } from './system-roles.guard';
import { ProjectRolesGuard } from './project-roles.guard';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ConfigModule,
  ],
  providers: [JwtStrategy, SystemRolesGuard, ProjectRolesGuard],
  exports: [PassportModule, SystemRolesGuard, ProjectRolesGuard],
})
export class AuthModule {}
