import { Injectable } from '@nestjs/common';
import { CookieOptions } from 'express';

@Injectable()
export class GeneratorService {
  generateNumericCode(length: number): string {
    let code = '';
    const possible = '0123456789';
    for (let i = 0; i < length; i++) {
      code += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return code;
  }

  generateCookieOptions(maxAge?: number) {
    const options: Partial<CookieOptions> = {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    };
    if (maxAge !== undefined) {
      options.maxAge = maxAge * 1000;
    }

    return options;
  }
}
