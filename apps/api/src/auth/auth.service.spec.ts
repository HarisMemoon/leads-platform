import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { AuthService } from './auth.service'
import { createDataSourceMock, createQueryRunnerMock, createRepositoryMock } from '../../test/helpers/testing'
import { buildUser } from '../../test/helpers/fixtures'

const verifyIdToken = jest.fn()

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken,
  })),
}))

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  function createService(configValues?: Record<string, string>) {
    const userRepo = createRepositoryMock<any>()
    const queryRunner = createQueryRunnerMock()
    const dataSource = createDataSourceMock(queryRunner)
    const jwtService = {
      sign: jest.fn(() => 'signed.jwt.token'),
    } as unknown as JwtService
    const config = {
      get: jest.fn((key: string) => configValues?.[key]),
    } as unknown as ConfigService

    const service = new AuthService(
      userRepo as any,
      jwtService,
      dataSource as any,
      config,
    )

    return { service, userRepo, dataSource, jwtService }
  }

  it('rejects duplicate email registration', async () => {
    const { service, userRepo } = createService()
    userRepo.findOne.mockResolvedValue(buildUser())

    await expect(
      service.register({
        email: 'buyer@example.com',
        password: 'Password123!',
        full_name: 'Buyer One',
        company_name: 'Acme',
      } as any),
    ).rejects.toThrow(ConflictException)
  })

  it('registers a user and bootstraps wallet plus onboarding records', async () => {
    const { service, userRepo, dataSource, jwtService } = createService()
    userRepo.findOne.mockResolvedValue(null)
    ;(dataSource.transaction as jest.Mock).mockImplementationOnce(async (cb) => {
      const manager = {
        create: jest.fn((_: unknown, input: unknown) => ({ id: 'user-1', ...input })),
        save: jest.fn(async (entity, maybeValue) => maybeValue ?? entity),
      }
      return cb(manager as any)
    })

    const result = await service.register({
      email: 'buyer@example.com',
      password: 'Password123!',
      full_name: 'Buyer One',
      company_name: 'Acme',
    } as any)

    expect(result).toEqual({ access_token: 'signed.jwt.token' })
    expect(jwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'buyer@example.com',
        role: 'buyer',
      }),
    )
  })

  it('rejects password login for Google-only accounts', async () => {
    const { service, userRepo } = createService()
    userRepo.findOne.mockResolvedValue(buildUser({ password_hash: null }))

    await expect(service.login('buyer@example.com', 'Password123!')).rejects.toThrow(
      'Use Google sign-in for this account',
    )
  })

  it('rejects invalid password login', async () => {
    const { service, userRepo } = createService()
    userRepo.findOne.mockResolvedValue(buildUser({ password_hash: '$2b$10$abcdefghijk' }))

    await expect(service.login('buyer@example.com', 'wrong')).rejects.toThrow(
      UnauthorizedException,
    )
  })

  it('requires server-side Google configuration', async () => {
    const { service } = createService({ GOOGLE_CLIENT_ID: '' })

    await expect(service.loginWithGoogleIdToken('id-token')).rejects.toThrow(
      BadRequestException,
    )
  })

  it('links an existing email account to Google when the subject is new', async () => {
    const { service, userRepo } = createService({ GOOGLE_CLIENT_ID: 'google-client-id' })
    const existing = buildUser({ email: 'buyer@example.com', google_sub: null })
    userRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing)
    userRepo.save.mockImplementation(async (value) => value)
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: 'buyer@example.com',
        sub: 'google-sub-1',
        name: 'Buyer One',
      }),
    })

    const result = await service.loginWithGoogleIdToken('google-id-token')

    expect(result).toEqual({ access_token: 'signed.jwt.token' })
    expect(existing.google_sub).toBe('google-sub-1')
    expect(userRepo.save).toHaveBeenCalledWith(existing)
  })

  it('rejects linking an email that already belongs to another Google subject', async () => {
    const { service, userRepo } = createService({ GOOGLE_CLIENT_ID: 'google-client-id' })
    userRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(buildUser({ email: 'buyer@example.com', google_sub: 'other-google-sub' }))
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: 'buyer@example.com',
        sub: 'google-sub-1',
        name: 'Buyer One',
      }),
    })

    await expect(service.loginWithGoogleIdToken('google-id-token')).rejects.toThrow(
      ConflictException,
    )
  })
})
