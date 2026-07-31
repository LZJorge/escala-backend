import { Module } from '@nestjs/common';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from '../application/auth.service';
import { PrismaAuthRepository } from './auth.repository.impl';
import { AUTH_REPOSITORY } from '../domain/auth.repository';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SuperAdminGuard } from './super-admin.guard';
import { PermissionsGuard } from './permissions.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        const expires = process.env.JWT_EXPIRATION;

        if (!secret) {
          throw new Error('FATAL: JWT_SECRET is not defined');
        }

        if (!expires) {
          throw new Error('FATAL: JWT_EXPIRATION is not defined');
        }

        const expiresInRegex = /^\d+[smhdy]$/;
        if (!expiresInRegex.test(expires)) {
          throw new Error(
            'FATAL: JWT_EXPIRATION has an invalid format. Expected format: 1s, 1m, 1h, 1d, 1w, 1y',
          );
        }

        return {
          secret,
          signOptions: {
            expiresIn: expires as JwtSignOptions['expiresIn'],
          },
        };
      },
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
