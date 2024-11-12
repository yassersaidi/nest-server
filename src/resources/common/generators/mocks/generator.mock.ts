import { vi } from 'vitest';
import { GeneratorService } from '../generator.service';

type GeneratorServiceServiceMockType = { [Property in keyof GeneratorService]: ReturnType<typeof vi.fn> };

export const GeneratorServiceMock: GeneratorServiceServiceMockType = {
    generateNumericCode: vi.fn(),
    generateCookieOptions: vi.fn()
};
