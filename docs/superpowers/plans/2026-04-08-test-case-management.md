# Test Case Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add QC-focused test case definition and test execution pages to PulseTrack, with module/suite organization, step-by-step execution, evidence attachments, and fail-to-bug auto-fill.

**Architecture:** Two new frontend pages (TestCasesPage, TestExecutionsPage) backed by four NestJS API modules (test-modules, test-cases, test-suites, test-executions). Nine new Prisma models. Follows existing patterns: DTOs with class-validator, React Query hooks, `api.ts` request helpers, shadcn/ui components.

**Tech Stack:** Prisma + PostgreSQL, NestJS (controller/service/module/DTO), React + TypeScript, TanStack React Query, TanStack React Table, shadcn/ui, Lucide icons, Multer (file uploads), Sonner (toasts).

---

## File Structure

### API (apps/api/src/)

| Path | Responsibility |
|---|---|
| `prisma/schema.prisma` | Add 3 enums + 9 models + testCaseSeq on Project |
| `test-modules/test-modules.module.ts` | NestJS module |
| `test-modules/test-modules.controller.ts` | CRUD endpoints for module tree |
| `test-modules/test-modules.service.ts` | Business logic |
| `test-modules/dto/create-test-module.dto.ts` | Validation |
| `test-modules/dto/update-test-module.dto.ts` | Validation |
| `test-cases/test-cases.module.ts` | NestJS module |
| `test-cases/test-cases.controller.ts` | CRUD + filters + bulk suite |
| `test-cases/test-cases.service.ts` | Business logic with testCaseSeq |
| `test-cases/dto/create-test-case.dto.ts` | Validation with nested steps/links |
| `test-cases/dto/update-test-case.dto.ts` | Partial update validation |
| `test-suites/test-suites.module.ts` | NestJS module |
| `test-suites/test-suites.controller.ts` | CRUD + member management |
| `test-suites/test-suites.service.ts` | Business logic |
| `test-suites/dto/create-test-suite.dto.ts` | Validation |
| `test-suites/dto/update-test-suite.dto.ts` | Validation |
| `test-executions/test-executions.module.ts` | NestJS module |
| `test-executions/test-executions.controller.ts` | CRUD + result updates + evidence uploads |
| `test-executions/test-executions.service.ts` | Business logic + stats |
| `test-executions/dto/create-test-execution.dto.ts` | Validation |
| `test-executions/dto/update-result.dto.ts` | Validation |
| `app.module.ts` | Register 4 new modules |

### Frontend (apps/web/src/)

| Path | Responsibility |
|---|---|
| `lib/types.ts` | Add all new TypeScript interfaces |
| `lib/api.ts` | Add all new API methods |
| `hooks/useTestModules.ts` | React Query hooks for modules |
| `hooks/useTestCases.ts` | React Query hooks for test cases |
| `hooks/useTestSuites.ts` | React Query hooks for suites |
| `hooks/useTestExecutions.ts` | React Query hooks for executions |
| `components/test-cases/ModuleTree.tsx` | Collapsible module tree sidebar |
| `components/test-cases/TestCasesTable.tsx` | Sortable/filterable table |
| `components/test-cases/TestCaseForm.tsx` | Create/edit dialog |
| `components/test-cases/StepsBuilder.tsx` | Step action+expected builder |
| `components/test-cases/SuiteManager.tsx` | Suite CRUD + member management |
| `components/test-executions/ExecutionList.tsx` | Cards with progress bars |
| `components/test-executions/ExecutionDetail.tsx` | Case checklist table |
| `components/test-executions/ExecutionRunner.tsx` | Step-by-step execution mode |
| `components/test-executions/CreateExecutionDialog.tsx` | New execution dialog |
| `components/test-executions/EvidenceUploader.tsx` | File upload for evidence |
| `components/test-executions/BugAutoFillDialog.tsx` | Pre-filled bug creation |
| `pages/TestCasesPage.tsx` | Main test cases page |
| `pages/TestExecutionsPage.tsx` | Main test executions page |
| `components/layout/AppSidebar.tsx` | Add 2 nav items |
| `App.tsx` | Add 2 routes |

---

### Task 1: Prisma Schema — Enums and Models

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add the three new enums after existing enums**

Add after the `EntityType` enum (around line 69):

```prisma
enum TestCaseStatus {
  DRAFT
  ACTIVE
  DEPRECATED
}

enum TestResultStatus {
  NOT_RUN
  IN_PROGRESS
  PASS
  FAIL
  BLOCKED
  SKIP
}

enum TestExecutionStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
}
```

- [ ] **Step 2: Add testCaseSeq to the Project model**

In the `Project` model, add after the `bugSeq` field (line 181):

```prisma
  testCaseSeq Int       @default(0)
```

- [ ] **Step 3: Add the 9 new models at the end of schema.prisma**

```prisma
// =====================
// TEST CASE MANAGEMENT
// =====================

model TestModule {
  id        String       @id @default(cuid())
  name      String
  position  Int
  projectId String
  parentId  String?

  project   Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  parent    TestModule?  @relation("TestModuleChildren", fields: [parentId], references: [id], onDelete: Cascade, onUpdate: NoAction)
  children  TestModule[] @relation("TestModuleChildren")
  testCases TestCase[]

  @@unique([projectId, parentId, name])
}

model TestCase {
  id               String         @id @default(cuid())
  testCaseKey      String?        @unique
  title            String
  preconditions    String?
  expectedResult   String?
  priority         Priority?
  status           TestCaseStatus @default(DRAFT)
  tags             String[]
  estimatedMinutes Int?
  moduleId         String
  projectId        String
  creatorId        String
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  module          TestModule          @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  project         Project             @relation(fields: [projectId], references: [id], onDelete: Cascade)
  creator         User                @relation("TestCaseCreator", fields: [creatorId], references: [id])
  steps           TestCaseStep[]
  links           TestCaseLink[]
  suiteMemberships TestSuiteMember[]
  executionCases  TestExecutionCase[]
}

model TestCaseStep {
  id             String   @id @default(cuid())
  testCaseId     String
  position       Int
  action         String
  expectedResult String

  testCase TestCase @relation(fields: [testCaseId], references: [id], onDelete: Cascade)

  @@unique([testCaseId, position])
}

model TestCaseLink {
  id         String     @id @default(cuid())
  testCaseId String
  entityType EntityType
  entityId   String

  testCase TestCase @relation(fields: [testCaseId], references: [id], onDelete: Cascade)

  @@unique([testCaseId, entityType, entityId])
}

model TestSuite {
  id          String   @id @default(cuid())
  name        String
  description String?
  projectId   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  project Project         @relation(fields: [projectId], references: [id], onDelete: Cascade)
  members TestSuiteMember[]
}

model TestSuiteMember {
  id         String @id @default(cuid())
  suiteId    String
  testCaseId String
  position   Int

  suite    TestSuite @relation(fields: [suiteId], references: [id], onDelete: Cascade)
  testCase TestCase  @relation(fields: [testCaseId], references: [id], onDelete: Cascade)

  @@unique([suiteId, testCaseId])
}

model TestExecution {
  id         String              @id @default(cuid())
  name       String
  status     TestExecutionStatus @default(PENDING)
  assigneeId String
  projectId  String
  sprintId   String?
  createdAt  DateTime            @default(now())
  updatedAt  DateTime            @updatedAt

  assignee User                @relation("TestExecutionAssignee", fields: [assigneeId], references: [id])
  project  Project             @relation(fields: [projectId], references: [id], onDelete: Cascade)
  sprint   Sprint?             @relation(fields: [sprintId], references: [id])
  cases    TestExecutionCase[]
}

model TestExecutionCase {
  id           String           @id @default(cuid())
  executionId  String
  testCaseId   String
  result       TestResultStatus @default(NOT_RUN)
  notes        String?
  executedById String?
  executedAt   DateTime?

  execution   TestExecution            @relation(fields: [executionId], references: [id], onDelete: Cascade)
  testCase    TestCase                 @relation(fields: [testCaseId], references: [id], onDelete: Cascade)
  executedBy  User?                    @relation("TestExecutionCaseExecutor", fields: [executedById], references: [id])
  attachments TestExecutionAttachment[]

  @@unique([executionId, testCaseId])
}

model TestExecutionAttachment {
  id              String   @id @default(cuid())
  executionCaseId String
  filename        String
  storedName      String
  mimeType        String
  size            Int
  uploaderId      String
  createdAt       DateTime @default(now())

  executionCase TestExecutionCase @relation(fields: [executionCaseId], references: [id], onDelete: Cascade)
  uploader      User              @relation("TestExecutionAttachmentUploader", fields: [uploaderId], references: [id])
}
```

- [ ] **Step 4: Add reverse relations to User, Project, and Sprint models**

In the `User` model, add these fields:

```prisma
  createdTestCases        TestCase[]               @relation("TestCaseCreator")
  assignedTestExecutions  TestExecution[]           @relation("TestExecutionAssignee")
  executedTestCases       TestExecutionCase[]       @relation("TestExecutionCaseExecutor")
  uploadedTestEvidence    TestExecutionAttachment[] @relation("TestExecutionAttachmentUploader")
```

In the `Project` model, add:

```prisma
  testModules    TestModule[]
  testCases      TestCase[]
  testSuites     TestSuite[]
  testExecutions TestExecution[]
```

In the `Sprint` model, add:

```prisma
  testExecutions TestExecution[]
```

- [ ] **Step 5: Generate Prisma client and run migration**

Run: `cd apps/api && npx prisma migrate dev --name add-test-case-management`

Expected: Migration created successfully, Prisma client regenerated.

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat: add test case management schema — 3 enums, 9 models, testCaseSeq"
```

---

### Task 2: Test Modules API (NestJS)

**Files:**
- Create: `apps/api/src/test-modules/test-modules.module.ts`
- Create: `apps/api/src/test-modules/test-modules.controller.ts`
- Create: `apps/api/src/test-modules/test-modules.service.ts`
- Create: `apps/api/src/test-modules/dto/create-test-module.dto.ts`
- Create: `apps/api/src/test-modules/dto/update-test-module.dto.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create DTOs**

`apps/api/src/test-modules/dto/create-test-module.dto.ts`:

```typescript
import { IsString, IsOptional, IsInt, Min, MinLength, MaxLength } from 'class-validator';

export class CreateTestModuleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsString()
  parentId?: string;
}
```

`apps/api/src/test-modules/dto/update-test-module.dto.ts`:

```typescript
import { IsString, IsOptional, IsInt, Min, MinLength, MaxLength } from 'class-validator';

export class UpdateTestModuleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsString()
  parentId?: string;
}
```

- [ ] **Step 2: Create the service**

`apps/api/src/test-modules/test-modules.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTestModuleDto } from './dto/create-test-module.dto';
import { UpdateTestModuleDto } from './dto/update-test-module.dto';

@Injectable()
export class TestModulesService {
  constructor(private prisma: PrismaService) {}

  async findAll(projectId: string) {
    return this.prisma.testModule.findMany({
      where: { projectId },
      orderBy: { position: 'asc' },
      include: {
        _count: { select: { testCases: true } },
      },
    });
  }

  async create(projectId: string, dto: CreateTestModuleDto) {
    // Auto-set position if not provided
    let position = dto.position;
    if (position === undefined) {
      const last = await this.prisma.testModule.findFirst({
        where: { projectId, parentId: dto.parentId ?? null },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      position = (last?.position ?? -1) + 1;
    }
    return this.prisma.testModule.create({
      data: {
        name: dto.name,
        position,
        projectId,
        parentId: dto.parentId ?? null,
      },
      include: { _count: { select: { testCases: true } } },
    });
  }

  async update(id: string, dto: UpdateTestModuleDto) {
    const existing = await this.prisma.testModule.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Test module not found');
    return this.prisma.testModule.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.position !== undefined && { position: dto.position }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
      },
      include: { _count: { select: { testCases: true } } },
    });
  }

  async delete(id: string) {
    const existing = await this.prisma.testModule.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Test module not found');
    return this.prisma.testModule.delete({ where: { id } });
  }
}
```

- [ ] **Step 3: Create the controller**

`apps/api/src/test-modules/test-modules.controller.ts`:

```typescript
import {
  Body, Controller, Delete, Get, Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { TestModulesService } from './test-modules.service';
import { CreateTestModuleDto } from './dto/create-test-module.dto';
import { UpdateTestModuleDto } from './dto/update-test-module.dto';

@Controller('projects/:projectId/test-modules')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class TestModulesController {
  constructor(private service: TestModulesService) {}

  @Get()
  findAll(@Param('projectId') projectId: string) {
    return this.service.findAll(projectId);
  }

  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateTestModuleDto,
  ) {
    return this.service.create(projectId, dto);
  }

  @Patch(':moduleId')
  update(
    @Param('moduleId') moduleId: string,
    @Body() dto: UpdateTestModuleDto,
  ) {
    return this.service.update(moduleId, dto);
  }

  @Delete(':moduleId')
  delete(@Param('moduleId') moduleId: string) {
    return this.service.delete(moduleId);
  }
}
```

- [ ] **Step 4: Create the module**

`apps/api/src/test-modules/test-modules.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TestModulesController } from './test-modules.controller';
import { TestModulesService } from './test-modules.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TestModulesController],
  providers: [TestModulesService],
  exports: [TestModulesService],
})
export class TestModulesModule {}
```

- [ ] **Step 5: Register in AppModule**

In `apps/api/src/app.module.ts`, add import:

```typescript
import { TestModulesModule } from './test-modules/test-modules.module';
```

Add `TestModulesModule` to the imports array.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/test-modules/ apps/api/src/app.module.ts
git commit -m "feat: add test-modules API — CRUD for hierarchical module tree"
```

---

### Task 3: Test Cases API (NestJS)

**Files:**
- Create: `apps/api/src/test-cases/test-cases.module.ts`
- Create: `apps/api/src/test-cases/test-cases.controller.ts`
- Create: `apps/api/src/test-cases/test-cases.service.ts`
- Create: `apps/api/src/test-cases/dto/create-test-case.dto.ts`
- Create: `apps/api/src/test-cases/dto/update-test-case.dto.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create DTOs**

`apps/api/src/test-cases/dto/create-test-case.dto.ts`:

```typescript
import {
  IsString, IsOptional, IsEnum, IsArray, IsInt, Min, MinLength, MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Priority } from '@prisma/client';

export class TestCaseStepDto {
  @IsInt()
  @Min(0)
  position: number;

  @IsString()
  @MaxLength(2000)
  action: string;

  @IsString()
  @MaxLength(2000)
  expectedResult: string;
}

export class TestCaseLinkDto {
  @IsString()
  entityType: string; // 'TASK' | 'BUG'

  @IsString()
  entityId: string;
}

export class CreateTestCaseDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  preconditions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  expectedResult?: string;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedMinutes?: number;

  @IsString()
  moduleId: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestCaseStepDto)
  steps?: TestCaseStepDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestCaseLinkDto)
  links?: TestCaseLinkDto[];
}
```

`apps/api/src/test-cases/dto/update-test-case.dto.ts`:

```typescript
import {
  IsString, IsOptional, IsEnum, IsArray, IsInt, Min, MinLength, MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Priority, TestCaseStatus } from '@prisma/client';
import { TestCaseStepDto, TestCaseLinkDto } from './create-test-case.dto';

export class UpdateTestCaseDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  preconditions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  expectedResult?: string;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsEnum(TestCaseStatus)
  status?: TestCaseStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedMinutes?: number;

  @IsOptional()
  @IsString()
  moduleId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestCaseStepDto)
  steps?: TestCaseStepDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestCaseLinkDto)
  links?: TestCaseLinkDto[];
}
```

- [ ] **Step 2: Create the service**

`apps/api/src/test-cases/test-cases.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTestCaseDto } from './dto/create-test-case.dto';
import { UpdateTestCaseDto } from './dto/update-test-case.dto';
import type { EntityType, Prisma } from '@prisma/client';

const TEST_CASE_INCLUDE = {
  steps: { orderBy: { position: 'asc' as const } },
  links: true,
  module: { select: { id: true, name: true } },
  creator: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
};

@Injectable()
export class TestCasesService {
  constructor(private prisma: PrismaService) {}

  async findAll(projectId: string, filters?: {
    moduleId?: string;
    suiteId?: string;
    status?: string;
    priority?: string;
    tags?: string;
    search?: string;
  }) {
    const where: Prisma.TestCaseWhereInput = { projectId };
    if (filters?.moduleId) where.moduleId = filters.moduleId;
    if (filters?.status) where.status = filters.status as any;
    if (filters?.priority) where.priority = filters.priority as any;
    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { testCaseKey: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters?.tags) {
      where.tags = { hasSome: filters.tags.split(',') };
    }
    if (filters?.suiteId) {
      where.suiteMemberships = { some: { suiteId: filters.suiteId } };
    }

    return this.prisma.testCase.findMany({
      where,
      include: {
        ...TEST_CASE_INCLUDE,
        _count: { select: { steps: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const tc = await this.prisma.testCase.findUnique({
      where: { id },
      include: TEST_CASE_INCLUDE,
    });
    if (!tc) throw new NotFoundException('Test case not found');
    return tc;
  }

  async create(projectId: string, creatorId: string, dto: CreateTestCaseDto) {
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.update({
        where: { id: projectId },
        data: { testCaseSeq: { increment: 1 } },
        select: { prefix: true, testCaseSeq: true },
      });
      const testCaseKey = project.prefix
        ? `${project.prefix}-TC-${project.testCaseSeq}`
        : `TC-${project.testCaseSeq}`;

      const testCase = await tx.testCase.create({
        data: {
          projectId,
          creatorId,
          testCaseKey,
          title: dto.title,
          preconditions: dto.preconditions,
          expectedResult: dto.expectedResult,
          priority: dto.priority,
          tags: dto.tags ?? [],
          estimatedMinutes: dto.estimatedMinutes,
          moduleId: dto.moduleId,
        },
        include: TEST_CASE_INCLUDE,
      });

      if (dto.steps?.length) {
        await tx.testCaseStep.createMany({
          data: dto.steps.map((s) => ({
            testCaseId: testCase.id,
            position: s.position,
            action: s.action,
            expectedResult: s.expectedResult,
          })),
        });
      }

      if (dto.links?.length) {
        await tx.testCaseLink.createMany({
          data: dto.links.map((l) => ({
            testCaseId: testCase.id,
            entityType: l.entityType as EntityType,
            entityId: l.entityId,
          })),
        });
      }

      return tx.testCase.findUniqueOrThrow({
        where: { id: testCase.id },
        include: TEST_CASE_INCLUDE,
      });
    });
  }

  async update(id: string, dto: UpdateTestCaseDto) {
    const existing = await this.prisma.testCase.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Test case not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.testCase.update({
        where: { id },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.preconditions !== undefined && { preconditions: dto.preconditions }),
          ...(dto.expectedResult !== undefined && { expectedResult: dto.expectedResult }),
          ...(dto.priority !== undefined && { priority: dto.priority }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.tags !== undefined && { tags: dto.tags }),
          ...(dto.estimatedMinutes !== undefined && { estimatedMinutes: dto.estimatedMinutes }),
          ...(dto.moduleId !== undefined && { moduleId: dto.moduleId }),
        },
      });

      if (dto.steps !== undefined) {
        await tx.testCaseStep.deleteMany({ where: { testCaseId: id } });
        if (dto.steps.length) {
          await tx.testCaseStep.createMany({
            data: dto.steps.map((s) => ({
              testCaseId: id,
              position: s.position,
              action: s.action,
              expectedResult: s.expectedResult,
            })),
          });
        }
      }

      if (dto.links !== undefined) {
        await tx.testCaseLink.deleteMany({ where: { testCaseId: id } });
        if (dto.links.length) {
          await tx.testCaseLink.createMany({
            data: dto.links.map((l) => ({
              testCaseId: id,
              entityType: l.entityType as EntityType,
              entityId: l.entityId,
            })),
          });
        }
      }

      return tx.testCase.findUniqueOrThrow({
        where: { id },
        include: TEST_CASE_INCLUDE,
      });
    });
  }

  async delete(id: string) {
    const existing = await this.prisma.testCase.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Test case not found');
    return this.prisma.testCase.delete({ where: { id } });
  }

  async bulkAddToSuite(suiteId: string, testCaseIds: string[]) {
    const suite = await this.prisma.testSuite.findUnique({ where: { id: suiteId } });
    if (!suite) throw new NotFoundException('Test suite not found');

    const lastMember = await this.prisma.testSuiteMember.findFirst({
      where: { suiteId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    let nextPosition = (lastMember?.position ?? -1) + 1;

    const existing = await this.prisma.testSuiteMember.findMany({
      where: { suiteId, testCaseId: { in: testCaseIds } },
      select: { testCaseId: true },
    });
    const existingIds = new Set(existing.map((e) => e.testCaseId));
    const newIds = testCaseIds.filter((id) => !existingIds.has(id));

    if (newIds.length) {
      await this.prisma.testSuiteMember.createMany({
        data: newIds.map((tcId) => ({
          suiteId,
          testCaseId: tcId,
          position: nextPosition++,
        })),
      });
    }

    return { added: newIds.length };
  }
}
```

- [ ] **Step 3: Create the controller**

`apps/api/src/test-cases/test-cases.controller.ts`:

```typescript
import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { TestCasesService } from './test-cases.service';
import { CreateTestCaseDto } from './dto/create-test-case.dto';
import { UpdateTestCaseDto } from './dto/update-test-case.dto';

@Controller('projects/:projectId/test-cases')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class TestCasesController {
  constructor(private service: TestCasesService) {}

  @Get()
  findAll(
    @Param('projectId') projectId: string,
    @Query('moduleId') moduleId?: string,
    @Query('suiteId') suiteId?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('tags') tags?: string,
    @Query('search') search?: string,
  ) {
    return this.service.findAll(projectId, {
      moduleId, suiteId, status, priority, tags, search,
    });
  }

  @Get(':testCaseId')
  findOne(@Param('testCaseId') testCaseId: string) {
    return this.service.findOne(testCaseId);
  }

  @Post()
  create(
    @Param('projectId') projectId: string,
    @Req() req: any,
    @Body() dto: CreateTestCaseDto,
  ) {
    return this.service.create(projectId, req.user.id, dto);
  }

  @Patch(':testCaseId')
  update(
    @Param('testCaseId') testCaseId: string,
    @Body() dto: UpdateTestCaseDto,
  ) {
    return this.service.update(testCaseId, dto);
  }

  @Delete(':testCaseId')
  delete(@Param('testCaseId') testCaseId: string) {
    return this.service.delete(testCaseId);
  }

  @Post('bulk-suite')
  bulkAddToSuite(
    @Body() body: { suiteId: string; testCaseIds: string[] },
  ) {
    return this.service.bulkAddToSuite(body.suiteId, body.testCaseIds);
  }
}
```

- [ ] **Step 4: Create the module**

`apps/api/src/test-cases/test-cases.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TestCasesController } from './test-cases.controller';
import { TestCasesService } from './test-cases.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TestCasesController],
  providers: [TestCasesService],
  exports: [TestCasesService],
})
export class TestCasesModule {}
```

- [ ] **Step 5: Register in AppModule**

Add import and `TestCasesModule` to the imports array in `apps/api/src/app.module.ts`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/test-cases/ apps/api/src/app.module.ts
git commit -m "feat: add test-cases API — CRUD with steps, links, filters, bulk suite"
```

---

### Task 4: Test Suites API (NestJS)

**Files:**
- Create: `apps/api/src/test-suites/test-suites.module.ts`
- Create: `apps/api/src/test-suites/test-suites.controller.ts`
- Create: `apps/api/src/test-suites/test-suites.service.ts`
- Create: `apps/api/src/test-suites/dto/create-test-suite.dto.ts`
- Create: `apps/api/src/test-suites/dto/update-test-suite.dto.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create DTOs**

`apps/api/src/test-suites/dto/create-test-suite.dto.ts`:

```typescript
import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateTestSuiteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
```

`apps/api/src/test-suites/dto/update-test-suite.dto.ts`:

```typescript
import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class UpdateTestSuiteDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
```

- [ ] **Step 2: Create the service**

`apps/api/src/test-suites/test-suites.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTestSuiteDto } from './dto/create-test-suite.dto';
import { UpdateTestSuiteDto } from './dto/update-test-suite.dto';

@Injectable()
export class TestSuitesService {
  constructor(private prisma: PrismaService) {}

  async findAll(projectId: string) {
    return this.prisma.testSuite.findMany({
      where: { projectId },
      include: {
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const suite = await this.prisma.testSuite.findUnique({
      where: { id },
      include: {
        members: {
          orderBy: { position: 'asc' },
          include: {
            testCase: {
              select: {
                id: true, testCaseKey: true, title: true, priority: true, status: true,
                _count: { select: { steps: true } },
              },
            },
          },
        },
      },
    });
    if (!suite) throw new NotFoundException('Test suite not found');
    return suite;
  }

  async create(projectId: string, dto: CreateTestSuiteDto) {
    return this.prisma.testSuite.create({
      data: { projectId, name: dto.name, description: dto.description },
      include: { _count: { select: { members: true } } },
    });
  }

  async update(id: string, dto: UpdateTestSuiteDto) {
    const existing = await this.prisma.testSuite.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Test suite not found');
    return this.prisma.testSuite.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
      include: { _count: { select: { members: true } } },
    });
  }

  async delete(id: string) {
    const existing = await this.prisma.testSuite.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Test suite not found');
    return this.prisma.testSuite.delete({ where: { id } });
  }

  async addMembers(suiteId: string, testCaseIds: string[]) {
    const suite = await this.prisma.testSuite.findUnique({ where: { id: suiteId } });
    if (!suite) throw new NotFoundException('Test suite not found');

    const lastMember = await this.prisma.testSuiteMember.findFirst({
      where: { suiteId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    let nextPosition = (lastMember?.position ?? -1) + 1;

    const existing = await this.prisma.testSuiteMember.findMany({
      where: { suiteId, testCaseId: { in: testCaseIds } },
      select: { testCaseId: true },
    });
    const existingIds = new Set(existing.map((e) => e.testCaseId));
    const newIds = testCaseIds.filter((id) => !existingIds.has(id));

    if (newIds.length) {
      await this.prisma.testSuiteMember.createMany({
        data: newIds.map((tcId) => ({
          suiteId,
          testCaseId: tcId,
          position: nextPosition++,
        })),
      });
    }
    return { added: newIds.length };
  }

  async removeMember(suiteId: string, testCaseId: string) {
    return this.prisma.testSuiteMember.delete({
      where: { suiteId_testCaseId: { suiteId, testCaseId } },
    });
  }
}
```

- [ ] **Step 3: Create the controller**

`apps/api/src/test-suites/test-suites.controller.ts`:

```typescript
import {
  Body, Controller, Delete, Get, Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { TestSuitesService } from './test-suites.service';
import { CreateTestSuiteDto } from './dto/create-test-suite.dto';
import { UpdateTestSuiteDto } from './dto/update-test-suite.dto';

@Controller('projects/:projectId/test-suites')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class TestSuitesController {
  constructor(private service: TestSuitesService) {}

  @Get()
  findAll(@Param('projectId') projectId: string) {
    return this.service.findAll(projectId);
  }

  @Get(':suiteId')
  findOne(@Param('suiteId') suiteId: string) {
    return this.service.findOne(suiteId);
  }

  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateTestSuiteDto,
  ) {
    return this.service.create(projectId, dto);
  }

  @Patch(':suiteId')
  update(
    @Param('suiteId') suiteId: string,
    @Body() dto: UpdateTestSuiteDto,
  ) {
    return this.service.update(suiteId, dto);
  }

  @Delete(':suiteId')
  delete(@Param('suiteId') suiteId: string) {
    return this.service.delete(suiteId);
  }

  @Post(':suiteId/members')
  addMembers(
    @Param('suiteId') suiteId: string,
    @Body() body: { testCaseIds: string[] },
  ) {
    return this.service.addMembers(suiteId, body.testCaseIds);
  }

  @Delete(':suiteId/members/:testCaseId')
  removeMember(
    @Param('suiteId') suiteId: string,
    @Param('testCaseId') testCaseId: string,
  ) {
    return this.service.removeMember(suiteId, testCaseId);
  }
}
```

- [ ] **Step 4: Create the module**

`apps/api/src/test-suites/test-suites.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TestSuitesController } from './test-suites.controller';
import { TestSuitesService } from './test-suites.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TestSuitesController],
  providers: [TestSuitesService],
  exports: [TestSuitesService],
})
export class TestSuitesModule {}
```

- [ ] **Step 5: Register in AppModule**

Add import and `TestSuitesModule` to the imports array in `apps/api/src/app.module.ts`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/test-suites/ apps/api/src/app.module.ts
git commit -m "feat: add test-suites API — CRUD with member management"
```

---

### Task 5: Test Executions API (NestJS)

**Files:**
- Create: `apps/api/src/test-executions/test-executions.module.ts`
- Create: `apps/api/src/test-executions/test-executions.controller.ts`
- Create: `apps/api/src/test-executions/test-executions.service.ts`
- Create: `apps/api/src/test-executions/dto/create-test-execution.dto.ts`
- Create: `apps/api/src/test-executions/dto/update-result.dto.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create DTOs**

`apps/api/src/test-executions/dto/create-test-execution.dto.ts`:

```typescript
import { IsString, IsOptional, IsArray, MinLength, MaxLength } from 'class-validator';

export class CreateTestExecutionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsString()
  assigneeId: string;

  @IsOptional()
  @IsString()
  sprintId?: string;

  @IsOptional()
  @IsString()
  suiteId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  testCaseIds?: string[];
}
```

`apps/api/src/test-executions/dto/update-result.dto.ts`:

```typescript
import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { TestResultStatus } from '@prisma/client';

export class UpdateResultDto {
  @IsEnum(TestResultStatus)
  result: TestResultStatus;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
```

- [ ] **Step 2: Create the service**

`apps/api/src/test-executions/test-executions.service.ts`:

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTestExecutionDto } from './dto/create-test-execution.dto';
import { UpdateResultDto } from './dto/update-result.dto';
import type { TestResultStatus } from '@prisma/client';

const EXECUTION_INCLUDE = {
  assignee: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
  sprint: { select: { id: true, name: true } },
  cases: {
    orderBy: { testCase: { testCaseKey: 'asc' as const } },
    include: {
      testCase: {
        select: {
          id: true, testCaseKey: true, title: true, priority: true,
          steps: { orderBy: { position: 'asc' as const } },
          links: true,
          expectedResult: true,
          preconditions: true,
        },
      },
      executedBy: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
      attachments: {
        include: {
          uploader: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
        },
      },
    },
  },
};

@Injectable()
export class TestExecutionsService {
  constructor(private prisma: PrismaService) {}

  async findAll(projectId: string) {
    const executions = await this.prisma.testExecution.findMany({
      where: { projectId },
      include: {
        assignee: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
        sprint: { select: { id: true, name: true } },
        cases: { select: { result: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return executions.map((exec) => {
      const stats = this.computeStats(exec.cases.map((c) => c.result));
      return { ...exec, cases: undefined, stats };
    });
  }

  async findOne(id: string) {
    const exec = await this.prisma.testExecution.findUnique({
      where: { id },
      include: EXECUTION_INCLUDE,
    });
    if (!exec) throw new NotFoundException('Test execution not found');

    const stats = this.computeStats(exec.cases.map((c) => c.result));
    return { ...exec, stats };
  }

  async create(projectId: string, dto: CreateTestExecutionDto) {
    let testCaseIds = dto.testCaseIds ?? [];

    if (dto.suiteId) {
      const members = await this.prisma.testSuiteMember.findMany({
        where: { suiteId: dto.suiteId },
        orderBy: { position: 'asc' },
        select: { testCaseId: true },
      });
      const suiteIds = members.map((m) => m.testCaseId);
      // Merge: suite IDs first, then any cherry-picked IDs not in suite
      const idSet = new Set(suiteIds);
      testCaseIds.forEach((id) => idSet.add(id));
      testCaseIds = [...idSet];
    }

    if (!testCaseIds.length) {
      throw new BadRequestException('At least one test case is required');
    }

    const execution = await this.prisma.testExecution.create({
      data: {
        name: dto.name,
        assigneeId: dto.assigneeId,
        projectId,
        sprintId: dto.sprintId,
        cases: {
          create: testCaseIds.map((tcId) => ({
            testCaseId: tcId,
          })),
        },
      },
      include: EXECUTION_INCLUDE,
    });

    const stats = this.computeStats(execution.cases.map((c) => c.result));
    return { ...execution, stats };
  }

  async updateStatus(id: string, status: string) {
    const existing = await this.prisma.testExecution.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Test execution not found');
    return this.prisma.testExecution.update({
      where: { id },
      data: { status: status as any },
    });
  }

  async updateResult(executionCaseId: string, userId: string, dto: UpdateResultDto) {
    const existing = await this.prisma.testExecutionCase.findUnique({
      where: { id: executionCaseId },
    });
    if (!existing) throw new NotFoundException('Execution case not found');

    const updated = await this.prisma.testExecutionCase.update({
      where: { id: executionCaseId },
      data: {
        result: dto.result,
        notes: dto.notes,
        executedById: userId,
        executedAt: new Date(),
      },
      include: {
        testCase: {
          select: {
            id: true, testCaseKey: true, title: true, priority: true,
            steps: { orderBy: { position: 'asc' as const } },
            links: true, expectedResult: true, preconditions: true,
          },
        },
        executedBy: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
        attachments: {
          include: {
            uploader: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
          },
        },
      },
    });

    // Auto-update execution status
    const execution = await this.prisma.testExecution.findUnique({
      where: { id: existing.executionId },
      include: { cases: { select: { result: true } } },
    });
    if (execution) {
      const allDone = execution.cases.every(
        (c) => c.result !== 'NOT_RUN' && c.result !== 'IN_PROGRESS',
      );
      const anyInProgress = execution.cases.some(
        (c) => c.result === 'IN_PROGRESS' || (c.result !== 'NOT_RUN'),
      );
      if (allDone && execution.status !== 'COMPLETED') {
        await this.prisma.testExecution.update({
          where: { id: execution.id },
          data: { status: 'COMPLETED' },
        });
      } else if (anyInProgress && execution.status === 'PENDING') {
        await this.prisma.testExecution.update({
          where: { id: execution.id },
          data: { status: 'IN_PROGRESS' },
        });
      }
    }

    return updated;
  }

  async addCases(executionId: string, testCaseIds: string[]) {
    const execution = await this.prisma.testExecution.findUnique({ where: { id: executionId } });
    if (!execution) throw new NotFoundException('Test execution not found');

    const existing = await this.prisma.testExecutionCase.findMany({
      where: { executionId, testCaseId: { in: testCaseIds } },
      select: { testCaseId: true },
    });
    const existingIds = new Set(existing.map((e) => e.testCaseId));
    const newIds = testCaseIds.filter((id) => !existingIds.has(id));

    if (newIds.length) {
      await this.prisma.testExecutionCase.createMany({
        data: newIds.map((tcId) => ({ executionId, testCaseId: tcId })),
      });
    }
    return { added: newIds.length };
  }

  async delete(id: string) {
    const existing = await this.prisma.testExecution.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Test execution not found');
    return this.prisma.testExecution.delete({ where: { id } });
  }

  async createAttachment(
    executionCaseId: string,
    uploaderId: string,
    file: Express.Multer.File,
  ) {
    return this.prisma.testExecutionAttachment.create({
      data: {
        executionCaseId,
        uploaderId,
        filename: file.originalname,
        storedName: file.filename,
        mimeType: file.mimetype,
        size: file.size,
      },
      include: {
        uploader: { select: { id: true, username: true, email: true, name: true, imageUrl: true } },
      },
    });
  }

  async deleteAttachment(attachmentId: string) {
    const attachment = await this.prisma.testExecutionAttachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');

    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), 'uploads', 'test-executions', attachment.executionCaseId, attachment.storedName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return this.prisma.testExecutionAttachment.delete({ where: { id: attachmentId } });
  }

  async getAttachmentFilePath(attachmentId: string) {
    const attachment = await this.prisma.testExecutionAttachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');

    const path = await import('path');
    const fs = await import('fs');
    const filePath = path.join(process.cwd(), 'uploads', 'test-executions', attachment.executionCaseId, attachment.storedName);
    if (!fs.existsSync(filePath)) throw new NotFoundException('File not found on disk');

    return { filePath, filename: attachment.filename, mimeType: attachment.mimeType };
  }

  private computeStats(results: TestResultStatus[]) {
    const total = results.length;
    const counts = {
      PASS: 0, FAIL: 0, BLOCKED: 0, SKIP: 0, NOT_RUN: 0, IN_PROGRESS: 0,
    };
    results.forEach((r) => { counts[r]++; });
    const completed = total - counts.NOT_RUN - counts.IN_PROGRESS;
    const completionPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, ...counts, completed, completionPercent };
  }
}
```

- [ ] **Step 3: Create the controller**

`apps/api/src/test-executions/test-executions.controller.ts`:

```typescript
import {
  Body, Controller, Delete, Get, Param, Patch, Post, Req, Res,
  UseGuards, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectRolesGuard } from '../auth/project-roles.guard';
import { TestExecutionsService } from './test-executions.service';
import { CreateTestExecutionDto } from './dto/create-test-execution.dto';
import { UpdateResultDto } from './dto/update-result.dto';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'test-executions');

@Controller('projects/:projectId/test-executions')
@UseGuards(JwtAuthGuard, ProjectRolesGuard)
export class TestExecutionsController {
  constructor(private service: TestExecutionsService) {}

  @Get()
  findAll(@Param('projectId') projectId: string) {
    return this.service.findAll(projectId);
  }

  @Get(':executionId')
  findOne(@Param('executionId') executionId: string) {
    return this.service.findOne(executionId);
  }

  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateTestExecutionDto,
  ) {
    return this.service.create(projectId, dto);
  }

  @Patch(':executionId/status')
  updateStatus(
    @Param('executionId') executionId: string,
    @Body() body: { status: string },
  ) {
    return this.service.updateStatus(executionId, body.status);
  }

  @Post(':executionId/cases')
  addCases(
    @Param('executionId') executionId: string,
    @Body() body: { testCaseIds: string[] },
  ) {
    return this.service.addCases(executionId, body.testCaseIds);
  }

  @Delete(':executionId')
  delete(@Param('executionId') executionId: string) {
    return this.service.delete(executionId);
  }

  @Patch('cases/:executionCaseId/result')
  updateResult(
    @Param('executionCaseId') executionCaseId: string,
    @Req() req: any,
    @Body() dto: UpdateResultDto,
  ) {
    return this.service.updateResult(executionCaseId, req.user.id, dto);
  }

  @Post('cases/:executionCaseId/attachments')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const caseId = req.params.executionCaseId as string;
          const dir = path.join(UPLOAD_DIR, caseId);
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname);
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadAttachment(
    @Param('executionCaseId') executionCaseId: string,
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.createAttachment(executionCaseId, req.user.id, file);
  }

  @Delete('attachments/:attachmentId')
  deleteAttachment(@Param('attachmentId') attachmentId: string) {
    return this.service.deleteAttachment(attachmentId);
  }

  @Get('attachments/:attachmentId/download')
  async downloadAttachment(
    @Param('attachmentId') attachmentId: string,
    @Res() res: Response,
  ) {
    const { filePath, filename, mimeType } = await this.service.getAttachmentFilePath(attachmentId);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', mimeType);
    res.sendFile(filePath);
  }
}
```

- [ ] **Step 4: Create the module**

`apps/api/src/test-executions/test-executions.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TestExecutionsController } from './test-executions.controller';
import { TestExecutionsService } from './test-executions.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TestExecutionsController],
  providers: [TestExecutionsService],
  exports: [TestExecutionsService],
})
export class TestExecutionsModule {}
```

- [ ] **Step 5: Register in AppModule**

Add import and `TestExecutionsModule` to the imports array in `apps/api/src/app.module.ts`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/test-executions/ apps/api/src/app.module.ts
git commit -m "feat: add test-executions API — CRUD, result tracking, evidence uploads, stats"
```

---

### Task 6: Frontend Types and API Client

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Add TypeScript interfaces to types.ts**

Append to the end of `apps/web/src/lib/types.ts`:

```typescript
// ─── Test Case Management ────────────────────────────────────────────────────

export type TestCaseStatus = 'DRAFT' | 'ACTIVE' | 'DEPRECATED';
export type TestResultStatus = 'NOT_RUN' | 'IN_PROGRESS' | 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIP';
export type TestExecutionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export interface TestModule {
  id: string;
  name: string;
  position: number;
  projectId: string;
  parentId: string | null;
  _count?: { testCases: number };
}

export interface TestCaseStep {
  id: string;
  testCaseId: string;
  position: number;
  action: string;
  expectedResult: string;
}

export interface TestCaseLink {
  id: string;
  testCaseId: string;
  entityType: EntityType;
  entityId: string;
}

export interface TestCase {
  id: string;
  testCaseKey: string | null;
  title: string;
  preconditions: string | null;
  expectedResult: string | null;
  priority: Priority | null;
  status: TestCaseStatus;
  tags: string[];
  estimatedMinutes: number | null;
  moduleId: string;
  projectId: string;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
  steps?: TestCaseStep[];
  links?: TestCaseLink[];
  module?: { id: string; name: string };
  creator?: Pick<User, 'id' | 'username' | 'email' | 'name' | 'imageUrl'>;
  _count?: { steps: number };
}

export interface CreateTestCasePayload {
  title: string;
  preconditions?: string;
  expectedResult?: string;
  priority?: Priority;
  tags?: string[];
  estimatedMinutes?: number;
  moduleId: string;
  steps?: { position: number; action: string; expectedResult: string }[];
  links?: { entityType: EntityType; entityId: string }[];
}

export interface UpdateTestCasePayload {
  title?: string;
  preconditions?: string;
  expectedResult?: string;
  priority?: Priority;
  status?: TestCaseStatus;
  tags?: string[];
  estimatedMinutes?: number;
  moduleId?: string;
  steps?: { position: number; action: string; expectedResult: string }[];
  links?: { entityType: EntityType; entityId: string }[];
}

export interface TestSuite {
  id: string;
  name: string;
  description: string | null;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  _count?: { members: number };
  members?: {
    id: string;
    position: number;
    testCase: Pick<TestCase, 'id' | 'testCaseKey' | 'title' | 'priority' | 'status'> & {
      _count?: { steps: number };
    };
  }[];
}

export interface CreateTestSuitePayload {
  name: string;
  description?: string;
}

export interface UpdateTestSuitePayload {
  name?: string;
  description?: string;
}

export interface TestExecutionStats {
  total: number;
  PASS: number;
  FAIL: number;
  BLOCKED: number;
  SKIP: number;
  NOT_RUN: number;
  IN_PROGRESS: number;
  completed: number;
  completionPercent: number;
}

export interface TestExecutionAttachment {
  id: string;
  executionCaseId: string;
  filename: string;
  storedName: string;
  mimeType: string;
  size: number;
  uploaderId: string;
  createdAt: string;
  uploader?: Pick<User, 'id' | 'username' | 'email' | 'name' | 'imageUrl'>;
}

export interface TestExecutionCase {
  id: string;
  executionId: string;
  testCaseId: string;
  result: TestResultStatus;
  notes: string | null;
  executedById: string | null;
  executedAt: string | null;
  testCase: Pick<TestCase, 'id' | 'testCaseKey' | 'title' | 'priority' | 'expectedResult' | 'preconditions'> & {
    steps: TestCaseStep[];
    links: TestCaseLink[];
  };
  executedBy?: Pick<User, 'id' | 'username' | 'email' | 'name' | 'imageUrl'> | null;
  attachments?: TestExecutionAttachment[];
}

export interface TestExecution {
  id: string;
  name: string;
  status: TestExecutionStatus;
  assigneeId: string;
  projectId: string;
  sprintId: string | null;
  createdAt: string;
  updatedAt: string;
  assignee?: Pick<User, 'id' | 'username' | 'email' | 'name' | 'imageUrl'>;
  sprint?: { id: string; name: string } | null;
  cases?: TestExecutionCase[];
  stats?: TestExecutionStats;
}

export interface CreateTestExecutionPayload {
  name: string;
  assigneeId: string;
  sprintId?: string;
  suiteId?: string;
  testCaseIds?: string[];
}
```

- [ ] **Step 2: Add API methods to api.ts**

Add the import of new types at the top of `api.ts`, then append these methods inside the `api` object:

```typescript
  // ─── Test Modules ──────────────────────────────────────────────────────────
  getTestModules: (projectId: string) =>
    request<TestModule[]>(`/projects/${projectId}/test-modules`),
  createTestModule: (projectId: string, data: { name: string; parentId?: string }) =>
    request<TestModule>(`/projects/${projectId}/test-modules`, { method: 'POST', body: JSON.stringify(data) }),
  updateTestModule: (moduleId: string, projectId: string, data: { name?: string; position?: number; parentId?: string }) =>
    request<TestModule>(`/projects/${projectId}/test-modules/${moduleId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTestModule: (moduleId: string, projectId: string) =>
    request<void>(`/projects/${projectId}/test-modules/${moduleId}`, { method: 'DELETE' }),

  // ─── Test Cases ────────────────────────────────────────────────────────────
  getTestCases: (projectId: string, params?: Record<string, string>) => {
    const sp = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v) sp.set(k, v); });
    const qs = sp.toString();
    return request<TestCase[]>(`/projects/${projectId}/test-cases${qs ? `?${qs}` : ''}`);
  },
  getTestCase: (projectId: string, testCaseId: string) =>
    request<TestCase>(`/projects/${projectId}/test-cases/${testCaseId}`),
  createTestCase: (projectId: string, data: CreateTestCasePayload) =>
    request<TestCase>(`/projects/${projectId}/test-cases`, { method: 'POST', body: JSON.stringify(data) }),
  updateTestCase: (projectId: string, testCaseId: string, data: UpdateTestCasePayload) =>
    request<TestCase>(`/projects/${projectId}/test-cases/${testCaseId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTestCase: (projectId: string, testCaseId: string) =>
    request<void>(`/projects/${projectId}/test-cases/${testCaseId}`, { method: 'DELETE' }),
  bulkAddToSuite: (projectId: string, suiteId: string, testCaseIds: string[]) =>
    request<{ added: number }>(`/projects/${projectId}/test-cases/bulk-suite`, {
      method: 'POST', body: JSON.stringify({ suiteId, testCaseIds }),
    }),

  // ─── Test Suites ──────────────────────────────────────────────────────────
  getTestSuites: (projectId: string) =>
    request<TestSuite[]>(`/projects/${projectId}/test-suites`),
  getTestSuite: (projectId: string, suiteId: string) =>
    request<TestSuite>(`/projects/${projectId}/test-suites/${suiteId}`),
  createTestSuite: (projectId: string, data: CreateTestSuitePayload) =>
    request<TestSuite>(`/projects/${projectId}/test-suites`, { method: 'POST', body: JSON.stringify(data) }),
  updateTestSuite: (projectId: string, suiteId: string, data: UpdateTestSuitePayload) =>
    request<TestSuite>(`/projects/${projectId}/test-suites/${suiteId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTestSuite: (projectId: string, suiteId: string) =>
    request<void>(`/projects/${projectId}/test-suites/${suiteId}`, { method: 'DELETE' }),
  addSuiteMembers: (projectId: string, suiteId: string, testCaseIds: string[]) =>
    request<{ added: number }>(`/projects/${projectId}/test-suites/${suiteId}/members`, {
      method: 'POST', body: JSON.stringify({ testCaseIds }),
    }),
  removeSuiteMember: (projectId: string, suiteId: string, testCaseId: string) =>
    request<void>(`/projects/${projectId}/test-suites/${suiteId}/members/${testCaseId}`, { method: 'DELETE' }),

  // ─── Test Executions ──────────────────────────────────────────────────────
  getTestExecutions: (projectId: string) =>
    request<TestExecution[]>(`/projects/${projectId}/test-executions`),
  getTestExecution: (projectId: string, executionId: string) =>
    request<TestExecution>(`/projects/${projectId}/test-executions/${executionId}`),
  createTestExecution: (projectId: string, data: CreateTestExecutionPayload) =>
    request<TestExecution>(`/projects/${projectId}/test-executions`, { method: 'POST', body: JSON.stringify(data) }),
  updateTestExecutionStatus: (projectId: string, executionId: string, status: string) =>
    request<void>(`/projects/${projectId}/test-executions/${executionId}/status`, {
      method: 'PATCH', body: JSON.stringify({ status }),
    }),
  addExecutionCases: (projectId: string, executionId: string, testCaseIds: string[]) =>
    request<{ added: number }>(`/projects/${projectId}/test-executions/${executionId}/cases`, {
      method: 'POST', body: JSON.stringify({ testCaseIds }),
    }),
  deleteTestExecution: (projectId: string, executionId: string) =>
    request<void>(`/projects/${projectId}/test-executions/${executionId}`, { method: 'DELETE' }),
  updateExecutionCaseResult: (projectId: string, executionCaseId: string, data: { result: string; notes?: string }) =>
    request<TestExecutionCase>(`/projects/${projectId}/test-executions/cases/${executionCaseId}/result`, {
      method: 'PATCH', body: JSON.stringify(data),
    }),
  uploadExecutionEvidence: async (projectId: string, executionCaseId: string, file: File): Promise<TestExecutionAttachment> => {
    const form = new FormData();
    form.append('file', file);
    const token = keycloak.token;
    const res = await fetch(`${API_BASE}/projects/${projectId}/test-executions/cases/${executionCaseId}/attachments`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { message?: string }).message || `Upload failed: ${res.status}`);
    }
    return res.json() as Promise<TestExecutionAttachment>;
  },
  deleteExecutionEvidence: (projectId: string, attachmentId: string) =>
    request<void>(`/projects/${projectId}/test-executions/attachments/${attachmentId}`, { method: 'DELETE' }),
  getExecutionEvidenceDownloadUrl: (projectId: string, attachmentId: string) =>
    `${API_BASE}/projects/${projectId}/test-executions/attachments/${attachmentId}/download`,
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/api.ts
git commit -m "feat: add test case management types and API client methods"
```

---

### Task 7: React Query Hooks

**Files:**
- Create: `apps/web/src/hooks/useTestModules.ts`
- Create: `apps/web/src/hooks/useTestCases.ts`
- Create: `apps/web/src/hooks/useTestSuites.ts`
- Create: `apps/web/src/hooks/useTestExecutions.ts`

- [ ] **Step 1: Create useTestModules.ts**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';

export function useTestModules(projectId: string) {
  return useQuery({
    queryKey: ['test-modules', projectId],
    queryFn: () => api.getTestModules(projectId),
    enabled: !!projectId,
  });
}

export function useCreateTestModule(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; parentId?: string }) =>
      api.createTestModule(projectId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['test-modules', projectId] });
      toast.success('Module created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateTestModule(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ moduleId, data }: { moduleId: string; data: { name?: string; position?: number; parentId?: string } }) =>
      api.updateTestModule(moduleId, projectId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['test-modules', projectId] });
      toast.success('Module updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteTestModule(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (moduleId: string) => api.deleteTestModule(moduleId, projectId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['test-modules', projectId] });
      toast.success('Module deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
```

- [ ] **Step 2: Create useTestCases.ts**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { CreateTestCasePayload, UpdateTestCasePayload } from '../lib/types';

export function useTestCases(projectId: string, filters?: Record<string, string>) {
  return useQuery({
    queryKey: ['test-cases', projectId, filters],
    queryFn: () => api.getTestCases(projectId, filters),
    enabled: !!projectId,
  });
}

export function useTestCase(projectId: string, testCaseId: string) {
  return useQuery({
    queryKey: ['test-case', projectId, testCaseId],
    queryFn: () => api.getTestCase(projectId, testCaseId),
    enabled: !!projectId && !!testCaseId,
  });
}

export function useCreateTestCase(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTestCasePayload) => api.createTestCase(projectId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['test-cases', projectId] });
      toast.success('Test case created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateTestCase(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ testCaseId, data }: { testCaseId: string; data: UpdateTestCasePayload }) =>
      api.updateTestCase(projectId, testCaseId, data),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ['test-cases', projectId] });
      void qc.invalidateQueries({ queryKey: ['test-case', projectId, variables.testCaseId] });
      toast.success('Test case updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteTestCase(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (testCaseId: string) => api.deleteTestCase(projectId, testCaseId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['test-cases', projectId] });
      toast.success('Test case deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
```

- [ ] **Step 3: Create useTestSuites.ts**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { CreateTestSuitePayload, UpdateTestSuitePayload } from '../lib/types';

export function useTestSuites(projectId: string) {
  return useQuery({
    queryKey: ['test-suites', projectId],
    queryFn: () => api.getTestSuites(projectId),
    enabled: !!projectId,
  });
}

export function useTestSuite(projectId: string, suiteId: string) {
  return useQuery({
    queryKey: ['test-suite', projectId, suiteId],
    queryFn: () => api.getTestSuite(projectId, suiteId),
    enabled: !!projectId && !!suiteId,
  });
}

export function useCreateTestSuite(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTestSuitePayload) => api.createTestSuite(projectId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['test-suites', projectId] });
      toast.success('Suite created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateTestSuite(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ suiteId, data }: { suiteId: string; data: UpdateTestSuitePayload }) =>
      api.updateTestSuite(projectId, suiteId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['test-suites', projectId] });
      toast.success('Suite updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteTestSuite(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (suiteId: string) => api.deleteTestSuite(projectId, suiteId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['test-suites', projectId] });
      toast.success('Suite deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
```

- [ ] **Step 4: Create useTestExecutions.ts**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { CreateTestExecutionPayload, TestExecutionAttachment } from '../lib/types';

export function useTestExecutions(projectId: string) {
  return useQuery({
    queryKey: ['test-executions', projectId],
    queryFn: () => api.getTestExecutions(projectId),
    enabled: !!projectId,
  });
}

export function useTestExecution(projectId: string, executionId: string) {
  return useQuery({
    queryKey: ['test-execution', projectId, executionId],
    queryFn: () => api.getTestExecution(projectId, executionId),
    enabled: !!projectId && !!executionId,
  });
}

export function useCreateTestExecution(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTestExecutionPayload) => api.createTestExecution(projectId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['test-executions', projectId] });
      toast.success('Execution created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateExecutionCaseResult(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ executionCaseId, data }: { executionCaseId: string; data: { result: string; notes?: string } }) =>
      api.updateExecutionCaseResult(projectId, executionCaseId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['test-execution', projectId] });
      void qc.invalidateQueries({ queryKey: ['test-executions', projectId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUploadExecutionEvidence(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ executionCaseId, file }: { executionCaseId: string; file: File }) =>
      api.uploadExecutionEvidence(projectId, executionCaseId, file),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['test-execution', projectId] });
      toast.success('Evidence uploaded');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteTestExecution(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (executionId: string) => api.deleteTestExecution(projectId, executionId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['test-executions', projectId] });
      toast.success('Execution deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/useTestModules.ts apps/web/src/hooks/useTestCases.ts apps/web/src/hooks/useTestSuites.ts apps/web/src/hooks/useTestExecutions.ts
git commit -m "feat: add React Query hooks for test case management"
```

---

### Task 8: Test Cases Page — Components and Page

**Files:**
- Create: `apps/web/src/components/test-cases/ModuleTree.tsx`
- Create: `apps/web/src/components/test-cases/TestCasesTable.tsx`
- Create: `apps/web/src/components/test-cases/TestCaseForm.tsx`
- Create: `apps/web/src/components/test-cases/StepsBuilder.tsx`
- Create: `apps/web/src/components/test-cases/SuiteManager.tsx`
- Create: `apps/web/src/pages/TestCasesPage.tsx`

This task creates the full Test Cases Page. Due to the size of these components, each step creates one component file following the patterns from the existing codebase (shadcn/ui, TanStack Table, Lucide icons, etc.).

- [ ] **Step 1: Create StepsBuilder component**

`apps/web/src/components/test-cases/StepsBuilder.tsx` — An ordered list builder where each row has "Action" and "Expected Result" fields. Add/remove/reorder steps. Tab from last field adds a new row.

The component accepts `steps` array and `onChange` callback. Uses `Button`, `Input` from shadcn/ui. `GripVertical`, `Plus`, `Trash2` from Lucide icons. Each step is `{ position: number; action: string; expectedResult: string }`.

- [ ] **Step 2: Create ModuleTree component**

`apps/web/src/components/test-cases/ModuleTree.tsx` — A collapsible tree sidebar showing modules hierarchically. Click module to select (filter). Right-click context menu for rename/delete. "+" button to add. Shows test case count per module. Also has a "Suites" section at the bottom listing suites with counts.

Uses `useTestModules`, `useTestSuites` hooks. `ChevronRight`, `ChevronDown`, `Folder`, `FolderOpen`, `Plus`, `MoreHorizontal` from Lucide. `DropdownMenu` from shadcn/ui for context actions.

- [ ] **Step 3: Create TestCaseForm component**

`apps/web/src/components/test-cases/TestCaseForm.tsx` — A dialog form for creating/editing test cases. Fields: title, preconditions (textarea), expected result (textarea), priority (select), module (select), tags (multi-input), estimated time (number), steps (StepsBuilder), links (task/bug search). Uses `Dialog`, `Input`, `Select`, `Textarea`, `Button` from shadcn/ui.

- [ ] **Step 4: Create SuiteManager component**

`apps/web/src/components/test-cases/SuiteManager.tsx` — A dialog for managing suites. Lists existing suites with edit/delete. Create new suite form with name + description. Shows members of selected suite.

- [ ] **Step 5: Create TestCasesTable component**

`apps/web/src/components/test-cases/TestCasesTable.tsx` — A TanStack React Table showing test cases. Columns: checkbox (for bulk select), ID (testCaseKey), Title, Priority, Status, Steps count, Est. Time, Tags. Sortable and filterable. Row click opens detail/edit. Bulk actions toolbar: add to suite, change status, delete. Uses same patterns as `BugsTable.tsx`.

- [ ] **Step 6: Create TestCasesPage**

`apps/web/src/pages/TestCasesPage.tsx` — The main page component. Layout: ModuleTree on the left (240px sidebar), TestCasesTable on the right. Toolbar with search, status filter, priority filter, and "+ New Test Case" button. State: selected module, selected suite filter, search, column filters. Uses `useTestCases` with filter params.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/test-cases/ apps/web/src/pages/TestCasesPage.tsx
git commit -m "feat: add Test Cases page — module tree, table, form, steps builder, suite manager"
```

---

### Task 9: Test Executions Page — Components and Page

**Files:**
- Create: `apps/web/src/components/test-executions/ExecutionList.tsx`
- Create: `apps/web/src/components/test-executions/ExecutionDetail.tsx`
- Create: `apps/web/src/components/test-executions/ExecutionRunner.tsx`
- Create: `apps/web/src/components/test-executions/CreateExecutionDialog.tsx`
- Create: `apps/web/src/components/test-executions/EvidenceUploader.tsx`
- Create: `apps/web/src/components/test-executions/BugAutoFillDialog.tsx`
- Create: `apps/web/src/pages/TestExecutionsPage.tsx`

- [ ] **Step 1: Create EvidenceUploader component**

`apps/web/src/components/test-executions/EvidenceUploader.tsx` — File drop zone + file list. Uses `useUploadExecutionEvidence` hook. Shows thumbnails for images, file icon for others. Delete button per file. Accepts `executionCaseId` and `projectId` props. Pattern follows existing attachment upload in BugAttachments.

- [ ] **Step 2: Create BugAutoFillDialog component**

`apps/web/src/components/test-executions/BugAutoFillDialog.tsx` — A dialog that pre-fills `CreateBugDialog` fields from a failed test case. Props: `testCase`, `executionCase`, `executionName`, `projectId`, `members`. Auto-fills: title as `[{testCaseKey}] {title}`, description with execution context, reproSteps from test case steps (highlighting failed step), expectedResult from test case, severity mapped from priority, parentTaskId from test case links. Uses `useCreateBug` hook.

- [ ] **Step 3: Create ExecutionRunner component**

`apps/web/src/components/test-executions/ExecutionRunner.tsx` — The step-by-step execution view. Shows: case header (key, title, priority), preconditions box, expected result box, steps list with current step highlighted, Pass/Fail/Blocked/Skip buttons per step, optional note input, Prev/Next case nav, "Mark All Pass" shortcut, evidence uploader section. On Fail, shows "Create Bug" button that opens BugAutoFillDialog. Uses `useUpdateExecutionCaseResult` hook.

- [ ] **Step 4: Create ExecutionDetail component**

`apps/web/src/components/test-executions/ExecutionDetail.tsx` — Shows the case checklist for an execution. Header with name, assignee, progress bar. Table: ID, Test Case title, Priority, Result badge (clickable dropdown), Executed By, Actions (Execute/View, Bug button for failures). "+ Add Cases" button. "Resume Testing" button opens ExecutionRunner for first NOT_RUN case.

- [ ] **Step 5: Create CreateExecutionDialog component**

`apps/web/src/components/test-executions/CreateExecutionDialog.tsx` — Dialog to create a new execution. Fields: name, assignee (member select), sprint (optional select), source (suite select OR cherry-pick test cases). Uses `useCreateTestExecution`, `useTestSuites`, `useTestCases`, `useMembers`, `useSprints` hooks.

- [ ] **Step 6: Create ExecutionList component**

`apps/web/src/components/test-executions/ExecutionList.tsx` — Cards showing executions with: name, status badge, assignee, suite, sprint, progress bar (color-coded segments), completion %, result counts. Click navigates to detail view. Status filter in toolbar.

- [ ] **Step 7: Create TestExecutionsPage**

`apps/web/src/pages/TestExecutionsPage.tsx` — The main page. Two views: list view (default, shows ExecutionList) and detail view (when an execution is selected, shows ExecutionDetail or ExecutionRunner). Toolbar with search, status filter, "+ New Execution" button. Uses `useTestExecutions` hook. State: selectedExecutionId, runnerMode (boolean).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/test-executions/ apps/web/src/pages/TestExecutionsPage.tsx
git commit -m "feat: add Test Executions page — list, detail, runner, evidence, bug auto-fill"
```

---

### Task 10: Routing and Sidebar Navigation

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/layout/AppSidebar.tsx`

- [ ] **Step 1: Add routes to App.tsx**

In `apps/web/src/App.tsx`, add imports at the top:

```typescript
import { TestCasesPage } from './pages/TestCasesPage';
import { TestExecutionsPage } from './pages/TestExecutionsPage';
```

Add two new `<Route>` elements after the bugs route (line 37) and before the members route:

```tsx
<Route path="/projects/:projectPrefix/test-cases" element={<TestCasesPage />} />
<Route path="/projects/:projectPrefix/test-executions" element={<TestExecutionsPage />} />
```

- [ ] **Step 2: Add sidebar navigation items**

In `apps/web/src/components/layout/AppSidebar.tsx`, add imports:

```typescript
import { ClipboardList, Play } from 'lucide-react';
```

Update the `PROJECT_NAV_ITEMS` array — add two items after the "Bugs" entry:

```typescript
const PROJECT_NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, path: 'dashboard' },
  { label: 'Backlog', icon: ListTodo, path: 'backlog' },
  { label: 'Sprints', icon: Zap, path: 'sprints' },
  { label: 'Bugs', icon: Bug, path: 'bugs' },
  { label: 'Test Cases', icon: ClipboardList, path: 'test-cases' },
  { label: 'Test Runs', icon: Play, path: 'test-executions' },
  { label: 'Members', icon: Users, path: 'members' },
  { label: 'Settings', icon: Settings, path: 'settings' },
];
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/components/layout/AppSidebar.tsx
git commit -m "feat: add test cases and executions routes and sidebar navigation"
```

---

### Task 11: Verify Build and Integration

- [ ] **Step 1: Run API build**

Run: `cd apps/api && npm run build`

Expected: No TypeScript compilation errors.

- [ ] **Step 2: Run web build**

Run: `cd apps/web && npm run build`

Expected: No TypeScript or Vite build errors.

- [ ] **Step 3: Run existing tests**

Run: `cd apps/api && npm test -- --passWithNoTests` and `cd apps/web && npm test -- --passWithNoTests`

Expected: All existing tests pass. No regressions.

- [ ] **Step 4: Fix any issues found and commit**

```bash
git add -A
git commit -m "fix: resolve build issues from test case management integration"
```
