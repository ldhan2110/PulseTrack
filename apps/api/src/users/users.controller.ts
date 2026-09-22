import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SystemRolesGuard } from '../auth/system-roles.guard';
import { SystemRoles } from '../auth/system-roles.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  getMe(@Req() req: any) {
    // req.user is already the DB user from JwtStrategy.validate()
    return this.usersService.sanitizeUser(req.user);
  }

  @Patch('me')
  updateMe(@Req() req: any, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateOwnProfile(req.user.id, dto);
  }

  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = join(process.cwd(), 'uploads', 'avatars');
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname);
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/^image\/(jpeg|png|gif|webp|svg\+xml)$/)) {
          cb(new BadRequestException('Only image files are allowed'), false);
        } else {
          cb(null, true);
        }
      },
    }),
  )
  uploadMyAvatar(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    const avatarUrl = `/api/uploads/avatars/${file.filename}`;
    return this.usersService.updateOwnAvatar(req.user.id, avatarUrl);
  }

  @Patch('me/password')
  changeMyPassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.usersService.changeOwnPassword(req.user.id, dto);
  }

  @Get()
  @UseGuards(SystemRolesGuard)
  @SystemRoles('admin')
  async findAll(@Req() req: any) {
    return this.usersService.findAll(req.user.id);
  }
}
