import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { PROVIDERS } from '../constants';
import { EmailService } from './email.service';

@Module({
  providers: [
    {
      provide: PROVIDERS.EMAIL_PROVIDER,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const resendApi = configService.get<string>('RESEND_API');
        return new Resend(resendApi);
      },
    },
    EmailService,
  ],
  exports: [EmailService],
})
export class EmailModule {}
