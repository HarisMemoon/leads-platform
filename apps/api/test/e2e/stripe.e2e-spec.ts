import request from 'supertest'
import { StripeController } from '../../src/stripe/stripe.controller'
import { StripeService } from '../../src/stripe/stripe.service'
import { JwtAuthGuard } from '../../src/auth/guards/jwt.auth.guard'
import { closeHttpApp, createHttpApp } from '../helpers/testing'

describe('StripeController (e2e)', () => {
  const stripeService = {
    createPaymentIntent: jest.fn(),
    confirmWalletTopUp: jest.fn(),
    handleWebhook: jest.fn(),
    savePaymentMethod: jest.fn(),
    getPaymentMethodPreview: jest.fn(),
    createCustomerPortal: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('validates payment intent requests and forwards save-card intent', async () => {
    const jwtSpy = jest
      .spyOn(JwtAuthGuard.prototype as any, 'canActivate')
      .mockImplementation((context: any) => {
        context.switchToHttp().getRequest().user = { userId: 'buyer-1' }
        return true
      })
    const { app } = await createHttpApp({
      controllers: [StripeController],
      providers: [
        { provide: StripeService, useValue: stripeService },
      ],
    })

    await request(app.getHttpServer())
      .post('/stripe/create-payment-intent')
      .send({ amountCents: 25 })
      .expect(400)

    stripeService.createPaymentIntent.mockResolvedValue({ clientSecret: 'secret_123' })

    await request(app.getHttpServer())
      .post('/stripe/create-payment-intent?save_card=true')
      .send({ amountCents: 2500 })
      .expect(201, { clientSecret: 'secret_123' })

    expect(stripeService.createPaymentIntent).toHaveBeenCalledWith(
      'buyer-1',
      2500,
      { saveForFutureUse: true },
    )

    await closeHttpApp(app)
    jwtSpy.mockRestore()
  })

  it('validates confirm-wallet-topup payloads', async () => {
    const jwtSpy = jest
      .spyOn(JwtAuthGuard.prototype as any, 'canActivate')
      .mockImplementation((context: any) => {
        context.switchToHttp().getRequest().user = { userId: 'buyer-1' }
        return true
      })
    const { app } = await createHttpApp({
      controllers: [StripeController],
      providers: [
        { provide: StripeService, useValue: stripeService },
      ],
    })

    await request(app.getHttpServer())
      .post('/stripe/confirm-wallet-topup')
      .send({})
      .expect(400)

    stripeService.confirmWalletTopUp.mockResolvedValue({ ok: true })

    await request(app.getHttpServer())
      .post('/stripe/confirm-wallet-topup')
      .send({ paymentIntentId: 'pi_123', savePaymentMethodForAutoReload: true })
      .expect(201, { ok: true })

    expect(stripeService.confirmWalletTopUp).toHaveBeenCalledWith('buyer-1', 'pi_123', {
      savePaymentMethodForAutoReload: true,
    })

    await closeHttpApp(app)
    jwtSpy.mockRestore()
  })
})
