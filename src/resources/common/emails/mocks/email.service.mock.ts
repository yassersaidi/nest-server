import { vi } from 'vitest';
import { EmailService } from '../email.service';

type EmailServiceMockType = { [Property in keyof EmailService]: ReturnType<typeof vi.fn> };

export const EmailServiceMock: EmailServiceMockType = {
    sendEmail: vi.fn(),
};

export const ResendMock = {
    emails: {
        send: vi.fn(),
    },
};

