import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';
import { SMSService } from './sms.service';
import { PROVIDERS } from '../constants';

@Module({
  providers: [
    {
      provide: PROVIDERS.SMS,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const accountSid = configService.get<string>('TWILIO_ACCOUNT_SID');
        const authToken = configService.get<string>('TWILIO_AUTH_TOKEN');
        return new Twilio(accountSid, authToken, {
          logLevel: 'debug',
          autoRetry: true,
          maxRetries: 3,
        });
      },
    },
    SMSService,
  ],
  exports: [SMSService],
})
export class SMSModule {}
