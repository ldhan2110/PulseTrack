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
