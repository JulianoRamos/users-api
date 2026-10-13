process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://users_api:users_api@localhost:5433/users_api_test?schema=public';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Users (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const valid = {
    name: 'Ana Souza',
    email: 'ana@example.com',
    password: 'secret123',
  };
  const missingId = '00000000-0000-4000-8000-000000000000';

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  const expectNoSecrets = (body: unknown) => {
    const text = JSON.stringify(body);
    expect(text).not.toMatch(/password/i);
  };

  it('runs the full CRUD flow', async () => {
    const created = await request(app.getHttpServer())
      .post('/users')
      .send({ ...valid, email: '  ANA@Example.com ' })
      .expect(201);
    expectNoSecrets(created.body);
    expect(created.body).toMatchObject({
      name: 'Ana Souza',
      email: 'ana@example.com',
    });
    const id = created.body.id as string;

    const list = await request(app.getHttpServer()).get('/users').expect(200);
    expectNoSecrets(list.body);
    expect(list.body.meta).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
    expect(list.body.data).toHaveLength(1);

    const one = await request(app.getHttpServer())
      .get(`/users/${id}`)
      .expect(200);
    expectNoSecrets(one.body);
    expect(one.body.id).toBe(id);

    const patched = await request(app.getHttpServer())
      .patch(`/users/${id}`)
      .send({ name: 'Ana Lima', password: 'newsecret123' })
      .expect(200);
    expectNoSecrets(patched.body);
    expect(patched.body.name).toBe('Ana Lima');

    await request(app.getHttpServer())
      .delete(`/users/${id}`)
      .expect(204)
      .expect((res) => expect(res.text).toBe(''));
    await request(app.getHttpServer()).get(`/users/${id}`).expect(404);
  });

  it('stores only a hash in the database', async () => {
    await request(app.getHttpServer()).post('/users').send(valid).expect(201);
    const row = await prisma.user.findFirstOrThrow();
    expect(row.passwordHash).not.toBe(valid.password);
    expect(row.passwordHash).toMatch(/^\$2[aby]\$10\$/);
  });

  it('paginates ordered by createdAt desc', async () => {
    for (const n of ['a', 'b', 'c']) {
      await request(app.getHttpServer())
        .post('/users')
        .send({ ...valid, email: `${n}@example.com` })
        .expect(201);
    }
    const res = await request(app.getHttpServer())
      .get('/users?page=2&limit=2')
      .expect(200);
    expect(res.body.meta).toEqual({
      page: 2,
      limit: 2,
      total: 3,
      totalPages: 2,
    });
    expect(res.body.data.map((u: { email: string }) => u.email)).toEqual([
      'a@example.com',
    ]);
  });

  describe('400', () => {
    it.each([
      ['empty body', {}],
      ['short name', { ...valid, name: 'A' }],
      ['bad email', { ...valid, email: 'nope' }],
      ['short password', { ...valid, password: '1234567' }],
      ['long password', { ...valid, password: 'x'.repeat(73) }],
      ['extra field', { ...valid, role: 'admin' }],
    ])('POST rejects %s', async (_n, body) => {
      const res = await request(app.getHttpServer())
        .post('/users')
        .send(body)
        .expect(400);
      expect(res.body).toHaveProperty('statusCode', 400);
      expect(res.body).toHaveProperty('error');
    });

    it('rejects invalid query', async () => {
      await request(app.getHttpServer()).get('/users?page=0').expect(400);
      await request(app.getHttpServer()).get('/users?limit=101').expect(400);
      await request(app.getHttpServer()).get('/users?page=abc').expect(400);
    });

    it('rejects non-UUID ids', async () => {
      await request(app.getHttpServer()).get('/users/abc').expect(400);
      await request(app.getHttpServer())
        .patch('/users/abc')
        .send({})
        .expect(400);
      await request(app.getHttpServer()).delete('/users/abc').expect(400);
    });

    it('PATCH rejects extra field', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/users')
        .send(valid);
      await request(app.getHttpServer())
        .patch(`/users/${body.id}`)
        .send({ passwordHash: 'x' })
        .expect(400);
    });
  });

  describe('404', () => {
    it('GET/PATCH/DELETE unknown id', async () => {
      await request(app.getHttpServer()).get(`/users/${missingId}`).expect(404);
      await request(app.getHttpServer())
        .patch(`/users/${missingId}`)
        .send({ name: 'Bo' })
        .expect(404);
      await request(app.getHttpServer())
        .delete(`/users/${missingId}`)
        .expect(404);
    });
  });

  describe('409', () => {
    it('POST with duplicate email', async () => {
      await request(app.getHttpServer()).post('/users').send(valid).expect(201);
      const res = await request(app.getHttpServer())
        .post('/users')
        .send({ ...valid, email: 'ANA@example.com' })
        .expect(409);
      expect(res.body).toMatchObject({ statusCode: 409, error: 'Conflict' });
    });

    it('PATCH to another user email, but not to own', async () => {
      await request(app.getHttpServer()).post('/users').send(valid).expect(201);
      const other = await request(app.getHttpServer())
        .post('/users')
        .send({ ...valid, email: 'bia@example.com' })
        .expect(201);
      await request(app.getHttpServer())
        .patch(`/users/${other.body.id}`)
        .send({ email: valid.email })
        .expect(409);
      await request(app.getHttpServer())
        .patch(`/users/${other.body.id}`)
        .send({ email: 'bia@example.com' })
        .expect(200);
    });
  });
});
