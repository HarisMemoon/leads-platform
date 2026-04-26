import { CanActivate, ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { DataSource, EntityManager, QueryRunner } from 'typeorm'

export function createRepositoryMock<T extends object>() {
  return {
    create: jest.fn((input?: Partial<T>) => input as T),
    save: jest.fn(async (input: T) => input),
    findOne: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    query: jest.fn(),
    createQueryBuilder: jest.fn(),
  } as {
    create: jest.Mock<T, [Partial<T>?]>
    save: jest.Mock<Promise<T>, [T]>
    findOne: jest.Mock
    find: jest.Mock
    delete: jest.Mock
    count: jest.Mock
    query: jest.Mock
    createQueryBuilder: jest.Mock
  }
}

export function createQueryBuilderMock(terminal: Record<string, unknown> = {}) {
  const qb: Record<string, jest.Mock> = {
    innerJoin: jest.fn(),
    innerJoinAndSelect: jest.fn(),
    leftJoinAndSelect: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    skip: jest.fn(),
    take: jest.fn(),
    select: jest.fn(),
    addSelect: jest.fn(),
    setLock: jest.fn(),
    getOne: jest.fn(),
    getMany: jest.fn(),
    getCount: jest.fn(),
    getManyAndCount: jest.fn(),
    getRawOne: jest.fn(),
  }

  Object.assign(qb, terminal)

  qb.innerJoin.mockReturnValue(qb)
  qb.innerJoinAndSelect.mockReturnValue(qb)
  qb.leftJoinAndSelect.mockReturnValue(qb)
  qb.where.mockReturnValue(qb)
  qb.andWhere.mockReturnValue(qb)
  qb.orderBy.mockReturnValue(qb)
  qb.skip.mockReturnValue(qb)
  qb.take.mockReturnValue(qb)
  qb.select.mockReturnValue(qb)
  qb.addSelect.mockReturnValue(qb)
  qb.setLock.mockReturnValue(qb)

  return qb
}

export function createQueryRunnerMock(overrides?: Partial<QueryRunner>) {
  const manager = {
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    save: jest.fn(async (input: unknown) => input),
    create: jest.fn((_: unknown, input: unknown) => input),
    query: jest.fn(),
    createQueryBuilder: jest.fn(),
    getRepository: jest.fn(),
  } as unknown as EntityManager

  const runner = {
    manager,
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    query: jest.fn(),
    ...overrides,
  } as unknown as QueryRunner & {
    manager: EntityManager & Record<string, jest.Mock>
    connect: jest.Mock
    startTransaction: jest.Mock
    commitTransaction: jest.Mock
    rollbackTransaction: jest.Mock
    release: jest.Mock
    query: jest.Mock
  }

  return runner
}

export function createDataSourceMock(queryRunner = createQueryRunnerMock()) {
  return {
    transaction: jest.fn(async (cb: (manager: EntityManager) => Promise<unknown>) =>
      cb(queryRunner.manager),
    ),
    createQueryRunner: jest.fn(() => queryRunner),
  } as unknown as DataSource & {
    transaction: jest.Mock
    createQueryRunner: jest.Mock
  }
}

class InjectUserGuard implements CanActivate {
  constructor(private readonly user: Record<string, unknown>) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest()
    request.user = this.user
    return true
  }
}

class AllowGuard implements CanActivate {
  canActivate() {
    return true
  }
}

export function createAuthGuard(user: Record<string, unknown>) {
  return new InjectUserGuard(user)
}

export function createPassThroughGuard() {
  return new AllowGuard()
}

export async function createHttpApp(options: {
  controllers: any[]
  providers: any[]
}) {
  const moduleRef: TestingModule = await Test.createTestingModule({
    controllers: options.controllers,
    providers: options.providers,
  }).compile()

  const app = moduleRef.createNestApplication()
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )
  await app.init()
  return { app, moduleRef }
}

export async function closeHttpApp(app: INestApplication) {
  await app.close()
}
