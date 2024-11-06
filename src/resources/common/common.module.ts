import { Global, Module } from '@nestjs/common';
import UAParser from 'ua-parser-js';

@Global()
@Module({
    providers: [
        {
            provide: 'UAParser',
            useValue: new UAParser(),
        },
    ],
    exports: ['UAParser'],
})
export class CommonModule {}
