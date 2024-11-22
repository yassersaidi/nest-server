import { UsersService } from '../users.service';
import { vi } from 'vitest';

type UsersServiceMockType = {
  [Property in keyof UsersService]: ReturnType<typeof vi.fn>;
};

export const UsersServiceMock: UsersServiceMockType = {
  create: vi.fn(),
  findUser: vi.fn(),
  findById: vi.fn(),
  getMe: vi.fn(),
  getAll: vi.fn(),
  searchUsers: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  isNotAdmin: vi.fn(),
};
