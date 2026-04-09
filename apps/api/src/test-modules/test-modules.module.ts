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
