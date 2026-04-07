import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { MembersModule } from './members/members.module';
import { TasksModule } from './tasks/tasks.module';
import { MyTasksModule } from './my-tasks/my-tasks.module';
import { SprintsModule } from './sprints/sprints.module';
import { BugsModule } from './bugs/bugs.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { CommentsModule } from './comments/comments.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { WorkflowModule } from './workflow/workflow.module';
import { RepositoryConfigModule } from './repository-config/repository-config.module';
import { AiConfigModule } from './ai-config/ai-config.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    QueueModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    MembersModule,
    TasksModule,
    MyTasksModule,
    SprintsModule,
    BugsModule,
    DashboardModule,
    CommentsModule,
    AttachmentsModule,
    NotificationsModule,
    WorkflowModule,
    RepositoryConfigModule,
    AiConfigModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
