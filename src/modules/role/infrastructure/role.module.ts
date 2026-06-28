import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/infrastructure/auth.module';
import { RoleController, RoleAssignmentController } from './role.controller';
import { RoleService } from '../application/role.service';

@Module({
  imports: [AuthModule],
  controllers: [RoleController, RoleAssignmentController],
  providers: [RoleService],
  exports: [RoleService],
})
export class RoleModule {}
