import { Injectable } from "@nestjs/common";

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
}