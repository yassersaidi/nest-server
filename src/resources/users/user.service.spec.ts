import { DefaultHttpException } from '@/resources/common/errors/error/custom-error.error';
import { DrizzleAsyncProvider } from '@/resources/database/database.module';
import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { UsersService } from './users.service';

import bcrypt from 'bcryptjs';

const configServiceMock = {
  get: vi.fn((key: string) => {
    const config = {
      PASSWORD_SALT: '13',
    };
    return config[key];
  }),
};

describe('Users Service', () => {
  let service: UsersService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      execute: vi.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: DrizzleAsyncProvider, useValue: mockDb },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('Users Service Should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const mockUser = {
      email: 'testing@mail.com',
      password: 'password123',
      username: 'testing',
      phoneNumber: '+21355555555',
    };

    const mockCreatedUser = {
      id: 'testing-123',
      email: 'testing@mail.com',
      username: 'testing',
      phoneNumber: '+21355555555',
    };

    beforeEach(() => {
      vi.spyOn(bcrypt, 'hash').mockImplementation(() =>
        Promise.resolve('hashed_password'),
      );
    });

    it('Should create a user successfully', async () => {
      mockDb.returning.mockResolvedValue([mockCreatedUser]);

      const result = await service.create(mockUser);

      expect(bcrypt.hash).toHaveBeenCalledWith(mockUser.password, 13);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith({
        ...mockUser,
        password: 'hashed_password',
      });
      expect(result).toEqual(mockCreatedUser);
    });

    it('Should throw conflict exception when email already exists', async () => {
      const error = {
        code: '23505',
        detail: 'Key (email)=(testing@mail.com) already exists',
        stack: 'error stack',
      };

      mockDb.returning.mockRejectedValue(error);

      await expect(service.create(mockUser)).rejects.toThrow(
        DefaultHttpException,
      );
      await expect(service.create(mockUser)).rejects.toThrow(
        'testing@mail.com already exists',
      );
    });

    it('Should throw Internal Server Error', async () => {
      const error = {
        message: 'unknown error',
      };

      mockDb.returning.mockRejectedValue(error);

      await expect(service.create(mockUser)).rejects.toThrow(
        new DefaultHttpException(
          error.message,
          '',
          'Register Service',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });
  });

  describe('findUser', () => {
    const mockUser = {
      id: 'testing-123',
      email: 'testing@mail.com',
      username: 'testing',
      phoneNumber: '+21355555555',
    };

    it('Should find user by email', async () => {
      mockDb.limit.mockResolvedValue([mockUser]);

      const result = await service.findUser({ email: mockUser.email });
      expect(result).toEqual(mockUser);
    });

    it('Should find user by phoneNumber', async () => {
      mockDb.limit.mockResolvedValue([mockUser]);

      const result = await service.findUser({
        phoneNumber: mockUser.phoneNumber,
      });
      expect(result).toEqual(mockUser);
    });

    it('Should find user by username', async () => {
      mockDb.limit.mockResolvedValue([mockUser]);

      const result = await service.findUser({ username: mockUser.username });
      expect(result).toEqual(mockUser);
    });

    it('Should throw exception when user not found by email', async () => {
      mockDb.limit.mockResolvedValue([]);

      await expect(
        service.findUser({ email: 'testing1@mail.com' }),
      ).rejects.toThrow(DefaultHttpException);
    });
    it('Should throw exception when user not found by phoneNumber', async () => {
      mockDb.limit.mockResolvedValue([]);

      await expect(
        service.findUser({ phoneNumber: '+2134545454' }),
      ).rejects.toThrow(DefaultHttpException);
    });

    it('Should throw exception when user not found by username', async () => {
      mockDb.limit.mockResolvedValue([]);

      await expect(
        service.findUser({ username: 'testing-111' }),
      ).rejects.toThrow(DefaultHttpException);
    });

    it('Should throw an exception when no email, username, phoneNumber provided', async () => {
      await expect(service.findUser({})).rejects.toThrow(DefaultHttpException);
    });
    it('Should throw exception when user not found by username', async () => {
      mockDb.select.mockRejectedValue(
        new DefaultHttpException(
          'Failed to find user',
          'An unexpected error occurred while searching for the user',
          'Users Service',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );

      await expect(
        service.findUser({ username: 'testing-111' }),
      ).rejects.toThrow(
        new DefaultHttpException(
          'Failed to find user',
          'An unexpected error occurred while searching for the user',
          'Users Service',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });
  });

  describe('findById', () => {
    const mockUser = {
      id: 'testing-123',
      email: 'testing@mail.com',
      username: 'testing',
      phoneNumber: '+21355555555',
    };

    it('Should find user by id', async () => {
      mockDb.limit.mockResolvedValue([mockUser]);

      const result = await service.findById(mockUser.id);
      expect(result).toEqual(mockUser);
    });

    it('Should throw exception when user not found', async () => {
      mockDb.limit.mockResolvedValue([]);

      await expect(service.findById('testing-1234')).rejects.toThrow(
        DefaultHttpException,
      );
    });
    it('Should throw exception when user not found by id', async () => {
      mockDb.select.mockRejectedValue(
        new DefaultHttpException(
          'Failed to find user',
          'An unexpected error occurred while searching for the user',
          'Users Service',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );

      await expect(service.findById('testing-111')).rejects.toThrow(
        new DefaultHttpException(
          'Failed to find user',
          'An unexpected error occurred while searching for the user',
          'Users Service',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });
  });

  describe('getMe', () => {
    const mockUser = {
      id: 'testing-123',
      email: 'testing@mail.com',
      username: 'testing',
      phoneNumber: '+21355555555',
      profilePicture: 'pic.jpg',
      emailVerified: true,
      phoneNumberVerified: true,
    };

    it('Should get current user details', async () => {
      mockDb.execute.mockResolvedValue([mockUser]);

      const result = await service.getMe(mockUser.id);
      expect(result).toEqual(mockUser);
    });

    it('Should throw exception when user not found', async () => {
      mockDb.execute.mockResolvedValue([]);

      await expect(service.getMe('testing-1234')).rejects.toThrow(
        DefaultHttpException,
      );
    });

    it('Should throw exception when trying to get user data', async () => {
      mockDb.select.mockRejectedValue(
        new DefaultHttpException(
          'Failed to find user',
          'An unexpected error occurred while searching for the user',
          'Users Service',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );

      await expect(service.getMe('testing-111')).rejects.toThrow(
        new DefaultHttpException(
          'Failed to find user',
          'An unexpected error occurred while searching for the user',
          'Users Service',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });
  });

  describe('getAll', () => {
    const mockUsers = [
      {
        id: 'testing-123',
        email: 'test1@mail.com',
        username: 'testing1',
      },
      {
        id: 'test-456',
        email: 'test2@mail.com',
        username: 'testing2',
      },
    ];

    it('Should get all users with pagination', async () => {
      mockDb.limit.mockResolvedValue(mockUsers);

      const result = await service.getAll({
        limit: 10,
        offset: 0,
        order: 1,
        sortBy: 'username',
      });

      expect(result).toEqual(mockUsers);
    });

    it('Should get all users with descending order', async () => {
      mockDb.limit.mockResolvedValue(mockUsers);

      const result = await service.getAll({
        limit: 10,
        offset: 0,
        order: -1,
        sortBy: 'username',
      });

      expect(result).toEqual(mockUsers);
    });
  });

  describe('searchUsers', () => {
    const mockUsers = [
      {
        id: 'testing-123',
        email: 'testing1@mail.com',
        username: 'testing-123',
        phoneNumber: '+21355555555',
      },
      {
        id: 'testing-456',
        email: 'testing2@mail.com',
        username: 'testing-456',
        phoneNumber: '+21355555556',
      },
    ];

    beforeEach(() => {
      mockDb.where.mockReset();
    });

    it('Should find users by email', async () => {
      mockDb.where.mockResolvedValue(mockUsers.slice(0, 1));

      const result = await service.searchUsers({
        email: 'testing1@mail.com',
        username: undefined,
      });

      expect(result).toEqual([mockUsers[0]]);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should find users by username', async () => {
      mockDb.where.mockResolvedValue(mockUsers.slice(1, 2));

      const result = await service.searchUsers({
        email: undefined,
        username: 'testing-456',
      });

      expect(result).toEqual([mockUsers[1]]);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should find multiple users matching criteria', async () => {
      mockDb.where.mockResolvedValue(mockUsers);

      const result = await service.searchUsers({
        email: 'testing1@mail.com',
        username: 'testing-456',
      });

      expect(result).toEqual(mockUsers);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should return empty array when no users found', async () => {
      mockDb.where.mockResolvedValue([]);

      const result = await service.searchUsers({
        email: 'testing-789@mail.com',
        username: 'testing-789',
      });

      expect(result).toEqual([]);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe('updateUser', () => {
    const mockUser = {
      id: 'testing-123',
      email: 'testing@mail.com',
      username: 'testing',
    };

    it('Should update user successfully', async () => {
      mockDb.returning.mockResolvedValue([
        { ...mockUser, username: 'newusername' },
      ]);

      const result = await service.updateUser(mockUser.id, {
        username: 'newusername',
      });
      expect(result).toEqual({ ...mockUser, username: 'newusername' });
    });

    it('Should throw exception when user not found', async () => {
      mockDb.returning.mockResolvedValue([]);

      await expect(
        service.updateUser('testing-1234', { username: 'newusername' }),
      ).rejects.toThrow(DefaultHttpException);
    });
  });

  describe('deleteUser', () => {
    const mockUser = {
      id: 'testing-123',
      email: 'testing@mail.com',
      username: 'testing',
      phoneNumber: '+21355555555',
      profilePicture: 'pic.jpg',
      emailVerified: true,
      phoneNumberVerified: true,
    };

    it('Should delete user successfully', async () => {
      mockDb.returning.mockResolvedValue([mockUser]);

      const result = await service.deleteUser('testing-123');
      expect(result).toEqual({ message: 'Your account has been deleted' });
    });
  });

  describe('admin checks', () => {
    const mockUser = {
      id: 'testing-123',
      email: 'testing@mail.com',
      username: 'testing',
      role: 'ADMIN',
    };

    describe('isNotAdmin', () => {
      it('Should throw exception when user is admin', async () => {
        mockDb.where.mockResolvedValue([mockUser]);

        await expect(service.isNotAdmin(mockUser.id)).rejects.toThrow(
          DefaultHttpException,
        );
      });

      it('Should return true when user is not admin', async () => {
        mockDb.where.mockResolvedValue([]);

        const result = await service.isNotAdmin(mockUser.id);
        expect(result).toBe(true);
      });
    });
  });
});
