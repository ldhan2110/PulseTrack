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
import { BranchesModule } from './branches/branches.module';
import { AiConfigModule } from './ai-config/ai-config.module';
import { SkillsModule } from './skills/skills.module';
import { TimeLogsModule } from './time-logs/time-logs.module';
import { BugAttachmentsModule } from './bug-attachments/bug-attachments.module';
import { WatchersModule } from './watchers/watchers.module';
import { SavedFiltersModule } from './saved-filters/saved-filters.module';
import { NotificationEmailModule } from './notification-email/notification-email.module';
import { TestModulesModule } from './test-modules/test-modules.module';
import { TestCasesModule } from './test-cases/test-cases.module';
import { TestSuitesModule } from './test-suites/test-suites.module';
import { TestExecutionsModule } from './test-executions/test-executions.module';
import { RolesModule } from './roles/roles.module';
import { WikiModule } from './wiki/wiki.module';
import { ReportConfigModule } from './report-config/report-config.module';
import { ReportGeneratorModule } from './report-generator/report-generator.module';
import { PlannerModule } from './planner/planner.module';
import { ScheduleModule } from '@nestjs/schedule';
import { WbsModule } from './wbs/wbs.module';
import { TestAutomationModule } from './test-automation/test-automation.module';
import { AgentsModule } from './agents/agents.module';
import { AiTaskGenerationModule } from './ai-task-generation/ai-task-generation.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
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
    BranchesModule,
    AiConfigModule,
    AiTaskGenerationModule,
SkillsModule,
    TimeLogsModule,
    BugAttachmentsModule,
    WatchersModule,
    SavedFiltersModule,
    NotificationEmailModule,
    TestModulesModule,
    TestCasesModule,
    TestSuitesModule,
    TestExecutionsModule,
    RolesModule,
    WikiModule,
    ReportConfigModule,
    ReportGeneratorModule,
    PlannerModule,
    WbsModule,
    TestAutomationModule,
    AgentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
