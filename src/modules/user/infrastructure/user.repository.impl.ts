import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/infrastructure/database/prisma.service';
import { User } from '@core/domain/user.entity';
import { UserRepository, UserListItem } from '../domain/user.repository';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async findAll(params: {
    skip: number;
    take: number;
  }): Promise<UserListItem[]> {
    type UserWithRoles = {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      ci: string;
      phone: string | null;
      isActive: boolean;
      roles: Array<{ role: { name: string } }>;
    };

    const records = await this.prisma.user.findMany({
      include: { roles: { include: { role: true } } },
      orderBy: { createdAt: 'asc' },
      skip: params.skip,
      take: params.take,
    });

    return records.map((r: UserWithRoles) => ({
      id: r.id,
      email: r.email,
      firstName: r.firstName,
      lastName: r.lastName,
      ci: r.ci,
      phone: r.phone,
      isActive: r.isActive,
      roles: r.roles.map((ur: { role: { name: string } }) => ur.role.name),
    }));
  }

  public async count(): Promise<number> {
    return this.prisma.user.count();
  }

  public async findById(id: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { id } });
    if (!record) {
      return null;
    }
    return new User(
      {
        email: record.email,
        password: record.password,
        firstName: record.firstName,
        lastName: record.lastName,
        ci: record.ci,
        phone: record.phone,
      },
      record.id,
    );
  }

  public async findByEmail(email: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { email } });
    if (!record) {
      return null;
    }
    return new User(
      {
        email: record.email,
        password: record.password,
        firstName: record.firstName,
        lastName: record.lastName,
        ci: record.ci,
        phone: record.phone,
      },
      record.id,
    );
  }

  public async findByCi(ci: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { ci } });
    if (!record) {
      return null;
    }
    return new User(
      {
        email: record.email,
        password: record.password,
        firstName: record.firstName,
        lastName: record.lastName,
        ci: record.ci,
        phone: record.phone,
      },
      record.id,
    );
  }

  public async save(user: User): Promise<void> {
    await this.prisma.user.create({
      data: {
        id: user.id,
        email: user.email,
        password: user.password,
        firstName: user.firstName,
        lastName: user.lastName,
        ci: user.ci,
        phone: user.phone,
      },
    });
  }

  public async update(user: User): Promise<void> {
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
      },
    });
  }

  public async softDelete(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });
  }
}
