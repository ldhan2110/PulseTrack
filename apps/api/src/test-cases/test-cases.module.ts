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
