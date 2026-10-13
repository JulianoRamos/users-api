# users-api

API NestJS 11 + Prisma 7 + PostgreSQL 16 com CRUD de `User`.

> Autenticação ainda não existe: os endpoints são abertos. Não exponha publicamente antes da feature de auth.

## Setup

```bash
npm install                 # roda `prisma generate` (postinstall)
docker compose up -d        # Postgres 16 em localhost:5433
cp .env.example .env
npx prisma migrate dev      # aplica as migrations em users_api
npm run start:dev           # http://localhost:3010
```

Se o npm bloquear scripts de instalação, aprove-os: `npm install-scripts approve bcrypt @prisma/engines`.

## Testes

```bash
npm test                    # unitários
npm run test:e2e            # e2e contra o banco users_api_test
```

O e2e usa `TEST_DATABASE_URL` (padrão `.../users_api_test`) e aplica as migrations sozinho. Crie o banco uma vez:

```bash
docker compose exec postgres psql -U users_api -c 'CREATE DATABASE users_api_test'
```

## Endpoints

```bash
# criar (201)
curl -X POST localhost:3010/users -H 'Content-Type: application/json' \
  -d '{"name":"Ana Souza","email":"ana@example.com","password":"secret123"}'

# listar com paginação (200)
curl 'localhost:3010/users?page=1&limit=20'

# buscar por id (200)
curl localhost:3010/users/<uuid>

# atualizar (200)
curl -X PATCH localhost:3010/users/<uuid> -H 'Content-Type: application/json' \
  -d '{"name":"Ana Lima"}'

# remover (204)
curl -X DELETE localhost:3010/users/<uuid>
```

Erros: 400 (validação / id não-UUID), 404 (não encontrado), 409 (e-mail já existe), no formato `{ statusCode, message, error }`.
Respostas nunca incluem `password` nem `passwordHash`.
