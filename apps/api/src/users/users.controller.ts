import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  async getMe(@Req() req: any) {
    // Upsert user from JWT on every /me call (syncs profile)
    const user = await this.usersService.upsertFromJwt(req.user);
    return user;
  }

  @Get()
  @Roles('pm', 'leadership')
  async findAll() {
    return this.usersService.findAll();
  }

  @Get('pm-only')
  @Roles('pm')
  pmOnly() {
    return { message: 'PM access confirmed' };
  }

  @Get('ba-only')
  @Roles('ba')
  baOnly() {
    return { message: 'BA access confirmed' };
  }

  @Get('dev-only')
  @Roles('developer')
  devOnly() {
    return { message: 'Developer access confirmed' };
  }

  @Get('leadership-only')
  @Roles('leadership')
  leadershipOnly() {
    return { message: 'Leadership access confirmed' };
  }
}
