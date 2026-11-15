import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController, MeController } from './auth.controller';
import { GoogleAuthService } from './google-auth.service';
import { GOOGLE_TOKEN_VERIFIER } from './google-verifier.interface';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';
import { CsrfGuard } from './csrf.guard';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController, MeController],
  providers: [
    AuthService,
    GoogleAuthService,
    {
      provide: GOOGLE_TOKEN_VERIFIER,
      useClass: GoogleAuthService,
    },
    AuthGuard,
    RolesGuard,
    CsrfGuard,
  ],
  exports: [AuthService, AuthGuard, RolesGuard, CsrfGuard, GOOGLE_TOKEN_VERIFIER],
})
export class AuthModule {}
