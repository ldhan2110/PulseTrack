import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { JwtStrategy } from './jwt.strategy';
import { ExternalJwtStrategy } from './external-jwt.strategy';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { LoginThrottlerGuard } from './login-throttler.guard';
import { SystemRolesGuard } from './system-roles.guard';
import { ProjectRolesGuard } from './project-roles.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
    ConfigModule,
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 5 }]),
    BullModule.registerQueue({ name: 'notification-email' }),
  ],
  controllers: [AuthController],
  providers: [
    JwtStrategy,
    ExternalJwtStrategy,
    AuthService,
    LoginThrottlerGuard,
    SystemRolesGuard,
    ProjectRolesGuard,
  ],
  exports: [PassportModule, AuthService, SystemRolesGuard, ProjectRolesGuard],
})
export class AuthModule {}
