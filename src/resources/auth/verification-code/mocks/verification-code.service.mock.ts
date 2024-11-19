import { vi } from 'vitest';
import { VerificationCodeService } from '../verification-code.service';

type VerificationCodeServiceMockType = {
  [Property in keyof VerificationCodeService]: ReturnType<typeof vi.fn>;
};

export const VerificationCodeServiceMock: VerificationCodeServiceMockType = {
  sendEmailVerificationCode: vi.fn(),
  verifyEmailCode: vi.fn(),
  sendPhoneVerificationCode: vi.fn(),
  verifyPhoneCode: vi.fn(),
  sendPasswordResetCode: vi.fn(),
  verifyPasswordResetCode: vi.fn(),
  checkExistingCode: vi.fn(),
  storeVerificationCode: vi.fn(),
  validateCode: vi.fn(),
  cleanupExpiredCodes: vi.fn(),
};
