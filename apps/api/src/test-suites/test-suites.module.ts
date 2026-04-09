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
