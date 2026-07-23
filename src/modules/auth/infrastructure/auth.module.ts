import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from '../application/auth.service';
import { PrismaAuthRepository } from './auth.repository.impl';
import { AUTH_REPOSITORY } from '../domain/auth.repository';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SuperAdminGuard } from './super-admin.guard';
import { PermissionsGuard } from './permissions.guard';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: AUTH_REPOSITORY, useClass: PrismaAuthRepository },
    JwtAuthGuard,
    SuperAdminGuard,
    PermissionsGuard,
  ],
  exports: [JwtAuthGuard, SuperAdminGuard, PermissionsGuard, JwtModule],
})
export class AuthModule {}
