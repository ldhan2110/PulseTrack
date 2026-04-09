import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(req.user.id, dto);
  }

  @Get()
  findAll(@Req() req: any) {
    return this.projectsService.findAllForUser(req.user.id);
  }

  @Get('by-prefix/:prefix')
  findByPrefix(@Param('prefix') prefix: string) {
    return this.projectsService.findByPrefix(prefix);
  }

  @Get(':projectId')
  @UseGuards(ProjectRolesGuard)
  findOne(@Param('projectId') projectId: string) {
    return this.projectsService.findOne(projectId);
  }

  @Patch(':projectId')
  @UseGuards(ProjectRolesGuard)
  @RequirePermission('projectSettings', 'update')
  update(@Param('projectId') projectId: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(projectId, dto);
  }

  @Post(':projectId/archive')
  @UseGuards(ProjectRolesGuard)
  @RequirePermission('projectSettings', 'update')
  archive(@Param('projectId') projectId: string) {
    return this.projectsService.archive(projectId);
  }

  @Post(':projectId/unarchive')
  @UseGuards(ProjectRolesGuard)
  @RequirePermission('projectSettings', 'update')
  unarchive(@Param('projectId') projectId: string) {
    return this.projectsService.unarchive(projectId);
  }

  @Patch(':projectId/settings')
  @UseGuards(ProjectRolesGuard)
  @RequirePermission('projectSettings', 'update')
  updateSettings(
    @Param('projectId') projectId: string,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.projectsService.updateSettings(projectId, dto);
  }

  @Post(':projectId/avatar')
  @UseGuards(ProjectRolesGuard)
  @RequirePermission('projectSettings', 'update')
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
  async uploadAvatar(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const avatarUrl = `/api/uploads/avatars/${file.filename}`;
    return this.projectsService.updateAvatar(projectId, avatarUrl);
  }

  @Delete(':projectId/avatar')
  @UseGuards(ProjectRolesGuard)
  @RequirePermission('projectSettings', 'update')
  removeAvatar(@Param('projectId') projectId: string) {
    return this.projectsService.updateAvatar(projectId, null);
  }
}
