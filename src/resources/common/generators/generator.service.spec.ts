import { Test, TestingModule } from "@nestjs/testing"
import { GeneratorService } from "./generator.service"

describe("Generator Service", () => {
    
    let service: GeneratorService
    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [GeneratorService]
        }).compile()

        service = module.get<GeneratorService>(GeneratorService)
    })

    it('Generator Service Should be defined', () => {
        expect(service).toBeDefined();
    })

    it("Should generate a numeric code of the specified length", () => {
        const length = 6;
        const result = service.generateNumericCode(length);
        expect(result).toHaveLength(length);
        expect(/^\d+$/.test(result)).toBe(true);
    });

    it("Should generate a random code each time", () => {
        const length = 6;
        const code1 = service.generateNumericCode(length);
        const code2 = service.generateNumericCode(length);
        expect(code1).not.toBe(code2);
    });


    it("Should generate options for cookies with maxAge", () => {
        const options = {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            maxAge: 10000
        }
        const cookieOptions = service.generateCookieOptions(10);
        expect(cookieOptions).toStrictEqual(options);
    });

    it("Should generate options for cookies without maxAge", () => {
        const options = {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
        }
        const cookieOptions = service.generateCookieOptions();
        expect(cookieOptions).toStrictEqual(options);
    });
})