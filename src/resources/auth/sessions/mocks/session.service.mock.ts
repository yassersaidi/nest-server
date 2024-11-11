import { vi } from 'vitest';
import { SessionService } from '../session.service';

type SessionServiceMockType = { [Property in keyof SessionService]: ReturnType<typeof vi.fn>}

export const SessionServiceMock: SessionServiceMockType = {
    createSession: vi.fn(),
    findSessionByRefreshToken: vi.fn(),
    deleteSessionByRefreshToken: vi.fn(),
    deleteExpiredSessions: vi.fn(),
    refreshToken: vi.fn(),
    getSessions: vi.fn(),
};
