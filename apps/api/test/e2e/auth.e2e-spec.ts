import request from 'supertest'
import { AuthController } from '../../src/auth/auth.controller'
import { AuthService } from '../../src/auth/auth.service'
import { closeHttpApp, createHttpApp } from '../helpers/testing'

describe('AuthController (e2e)', () => {
  const authService = {
    register: jest.fn(),
    login: jest.fn(),
    loginWithGoogleIdToken: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('validates register payloads and forwards valid ones to the auth service', async () => {
    const { app } = await createHttpApp({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    })

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'invalid' })
      .expect(400)

    authService.register.mockResolvedValue({ access_token: 'jwt-token' })

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'buyer@example.com',
        password: 'Password123!',
        full_name: 'Buyer One',
        company_name: 'Acme Investors',
      })
      .expect(201, { access_token: 'jwt-token' })

    expect(authService.register).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'buyer@example.com' }),
    )

    await closeHttpApp(app)
  })
})
