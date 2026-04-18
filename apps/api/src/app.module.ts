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
import { AiTaskGenerationModule } from './ai-task-generation/ai-task-generation.module';
import { AiTestCaseGenerationModule } from './ai-testcase-generation/ai-testcase-generation.module';
import { AiWbsGenerationModule } from './ai-wbs-generation/ai-wbs-generation.module';
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
import { WikiConfigModule } from './wiki-config/wiki-config.module';
import { WikiGenerationModule } from './wiki-generation/wiki-generation.module';
import { WikiModule } from './wiki/wiki.module';
import { ReportConfigModule } from './report-config/report-config.module';
import { ReportGeneratorModule } from './report-generator/report-generator.module';
import { PlannerModule } from './planner/planner.module';
import { PlannerAiConfigModule } from './planner-ai-config/planner-ai-config.module';
import { WbsModule } from './wbs/wbs.module';

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
    BranchesModule,
    AiConfigModule,
    AiTaskGenerationModule,
    AiTestCaseGenerationModule,
    AiWbsGenerationModule,
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
    WikiConfigModule,
    WikiGenerationModule,
    WikiModule,
    ReportConfigModule,
    ReportGeneratorModule,
    PlannerModule,
    PlannerAiConfigModule,
    WbsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
