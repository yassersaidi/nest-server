import { Global, Module } from '@nestjs/common';
import UAParser from 'ua-parser-js';
import { SMSModule } from './sms/sms.module';
import { EmailModule } from './emails/email.module';
import { PROVIDERS } from './constants';
import { GeneratorModule } from './generators/generator.module';

@Global()
@Module({
  imports: [SMSModule, EmailModule, GeneratorModule],
  providers: [
    {
      provide: PROVIDERS.USER_AGENT_PARSER,
      useValue: new UAParser(),
    },
  ],
  exports: [PROVIDERS.USER_AGENT_PARSER, SMSModule, EmailModule, GeneratorModule],
})
export class CommonModule { }