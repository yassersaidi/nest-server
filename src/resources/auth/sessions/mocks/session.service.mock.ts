import { vi } from 'vitest';
import { SessionService } from '../session.service';

type SessionServiceMockType = {
  [Property in keyof SessionService]: ReturnType<typeof vi.fn>;
};

export const SessionServiceMock: SessionServiceMockType = {
  createSession: vi.fn(),
  findSessionById: vi.fn(),
  deleteSessionById: vi.fn(),
  deleteExpiredSessions: vi.fn(),
  refreshToken: vi.fn(),
  getSessions: vi.fn(),
  generateAccessToken: vi.fn(),
  generateRefreshToken: vi.fn(),
};
