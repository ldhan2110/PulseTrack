import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SystemRolesGuard } from '../auth/system-roles.guard';
import { SystemRoles } from '../auth/system-roles.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  getMe(@Req() req: any) {
    // req.user is already the DB user from JwtStrategy.validate()
    return req.user;
  }

  @Get()
  @UseGuards(SystemRolesGuard)
  @SystemRoles('admin')
  async findAll() {
    return this.usersService.findAll();
  }
}
