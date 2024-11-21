import { vi } from 'vitest';
import { SMSService } from '../sms.service';

type SMSServiceMockType = {
  [Property in keyof SMSService]: ReturnType<typeof vi.fn>;
};

export const SMSServiceMock: SMSServiceMockType = {
  send: vi.fn(),
};

export const TwilioMock = {
  messages: {
    create: vi.fn()
  }
}