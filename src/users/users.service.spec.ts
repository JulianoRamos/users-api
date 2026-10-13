import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

const now = new Date();
const stored = (over: Record<string, unknown> = {}) => ({
  id: 'id-1',
  name: 'Ana',
  email: 'ana@example.com',
  passwordHash: 'hash',
  createdAt: now,
  updatedAt: now,
  ...over,
});

describe('UsersService', () => {
  let service: UsersService;
  const prisma = {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((ops: Promise<unknown>[]) =>
      Promise.all(ops),
    );
    const mod = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = mod.get(UsersService);
  });

  describe('create', () => {
    it('stores a bcrypt hash and never the plain password', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }) =>
        Promise.resolve(stored(data)),
      );
      await service.create({
        name: 'Ana',
        email: 'ana@example.com',
        password: 'secret123',
      });
      const data = prisma.user.create.mock.calls[0][0].data;
      expect(data.password).toBeUndefined();
      expect(data.passwordHash).not.toBe('secret123');
      expect(await bcrypt.compare('secret123', data.passwordHash)).toBe(true);
    });

    it('throws 409 when email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue(stored());
      await expect(
        service.create({
          name: 'Ana',
          email: 'ana@example.com',
          password: 'secret123',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('maps P2002 race to 409', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockRejectedValue({ code: 'P2002' });
      await expect(
        service.create({
          name: 'Ana',
          email: 'ana@example.com',
          password: 'secret123',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('findAll', () => {
    it('paginates and computes totalPages', async () => {
      prisma.user.count.mockResolvedValue(45);
      prisma.user.findMany.mockResolvedValue([stored()]);
      const res = await service.findAll({ page: 2, limit: 20 });
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        skip: 20,
        take: 20,
      });
      expect(res.meta).toEqual({
        page: 2,
        limit: 20,
        total: 45,
        totalPages: 3,
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('returns totalPages 0 when empty', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.user.findMany.mockResolvedValue([]);
      const res = await service.findAll({ page: 1, limit: 20 });
      expect(res.meta.totalPages).toBe(0);
    });
  });

  describe('findOne', () => {
    it('returns the user', async () => {
      prisma.user.findUnique.mockResolvedValue(stored());
      await expect(service.findOne('id-1')).resolves.toMatchObject({
        id: 'id-1',
      });
    });
    it('throws 404 when missing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.findOne('x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('throws 404 when missing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.update('x', { name: 'Bo' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws 409 when email belongs to another user', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(stored())
        .mockResolvedValueOnce(stored({ id: 'other' }));
      await expect(
        service.update('id-1', { email: 'b@example.com' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('generates a new hash when the password changes', async () => {
      prisma.user.findUnique.mockResolvedValue(stored());
      prisma.user.update.mockResolvedValue(stored());
      await service.update('id-1', { password: 'newsecret1' });
      const data = prisma.user.update.mock.calls[0][0].data;
      expect(data.password).toBeUndefined();
      expect(await bcrypt.compare('newsecret1', data.passwordHash)).toBe(true);
    });

    it('does not touch the hash when no password is sent', async () => {
      prisma.user.findUnique.mockResolvedValue(stored());
      prisma.user.update.mockResolvedValue(stored());
      await service.update('id-1', { name: 'Bia' });
      expect(prisma.user.update.mock.calls[0][0].data).toEqual({ name: 'Bia' });
    });

    it('maps P2025 to 404', async () => {
      prisma.user.findUnique.mockResolvedValue(stored());
      prisma.user.update.mockRejectedValue({ code: 'P2025' });
      await expect(
        service.update('id-1', { name: 'Bia' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes the user', async () => {
      prisma.user.delete.mockResolvedValue(stored());
      await expect(service.remove('id-1')).resolves.toBeUndefined();
    });
    it('maps P2025 to 404', async () => {
      prisma.user.delete.mockRejectedValue({ code: 'P2025' });
      await expect(service.remove('x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
