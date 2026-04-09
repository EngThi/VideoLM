import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: 'FLAVORTOWN_SECRET', // Placeholder
      signOptions: { expiresIn: '7d' },
    }),
  ],
})
export class AuthModule {}
