import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByKeycloakId(keycloakId: string) {
    return this.prisma.user.findUnique({ where: { keycloakId } });
  }

  async findAll() {
    return this.prisma.user.findMany();
  }
}
