import { BadRequestException, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { StripeService } from './stripe.service'
import { createRepositoryMock } from '../../test/helpers/testing'
import { buildSubscription, buildUser, buildWallet } from '../../test/helpers/fixtures'

const stripeClientMock = {
  paymentIntents: {
    create: jest.fn(),
    retrieve: jest.fn(),
  },
  webhooks: {
    constructEvent: jest.fn(),
  },
  customers: {
    create: jest.fn(),
    update: jest.fn(),
  },
  paymentMethods: {
    attach: jest.fn(),
    retrieve: jest.fn(),
  },
  subscriptions: {
    cancel: jest.fn(),
  },
  checkout: {
    sessions: {
      create: jest.fn(),
    },
  },
  billingPortal: {
    sessions: {
      create: jest.fn(),
    },
  },
}

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => stripeClientMock)
})

describe('StripeService', () => {
  const walletService = {
    applyStripeTopUp: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  function createService(configValues?: Record<string, string>) {
    const config = {
      get: jest.fn((key: string) => {
        const defaults: Record<string, string> = {
          STRIPE_SECRET_KEY: 'sk_test_123',
          STRIPE_WEBHOOK_SECRET: 'whsec_123',
          APP_BASE_URL: 'https://app.example.com',
        }
        return (configValues ?? defaults)[key] ?? defaults[key]
      }),
    } as unknown as ConfigService

    const userRepo = createRepositoryMock<any>()
    const walletRepo = createRepositoryMock<any>()
    const subscriptionRepo = createRepositoryMock<any>()

    const service = new StripeService(
      config,
      userRepo as any,
      walletRepo as any,
      subscriptionRepo as any,
      walletService as any,
    )

    return { service, config, userRepo, walletRepo, subscriptionRepo }
  }

  it('creates a payment intent and can request future-use setup', async () => {
    const { service, userRepo } = createService()
    userRepo.findOne.mockResolvedValue(buildUser({ stripe_customer_id: 'cus_123' }))
    stripeClientMock.paymentIntents.create.mockResolvedValue({ client_secret: 'secret_123' })

    const result = await service.createPaymentIntent('user-1', 2500, {
      saveForFutureUse: true,
    })

    expect(result).toEqual({ clientSecret: 'secret_123' })
    expect(stripeClientMock.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2500,
        metadata: { userId: 'user-1', amountCents: '2500' },
        setup_future_usage: 'off_session',
      }),
    )
  })

  it('throws when Stripe does not return a client secret', async () => {
    const { service, userRepo } = createService()
    userRepo.findOne.mockResolvedValue(buildUser({ stripe_customer_id: 'cus_123' }))
    stripeClientMock.paymentIntents.create.mockResolvedValue({ client_secret: null })

    await expect(service.createPaymentIntent('user-1', 2500)).rejects.toThrow(
      BadRequestException,
    )
  })

  it('credits the wallet immediately for succeeded auto-reload charges', async () => {
    const { service } = createService()
    stripeClientMock.paymentIntents.create.mockResolvedValue({
      id: 'pi_auto_1',
      status: 'succeeded',
    })

    const result = await service.chargeWalletAutoReload(
      'user-1',
      3200,
      'pm_123',
      'cus_123',
      { balanceCentsForIdempotency: '150' },
    )

    expect(result.status).toBe('succeeded')
    expect(walletService.applyStripeTopUp).toHaveBeenCalledWith(
      'user-1',
      3200,
      'pi_auto_1',
      'Wallet auto-reload',
    )
    expect(stripeClientMock.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        confirm: true,
        off_session: true,
        payment_method: 'pm_123',
      }),
      expect.objectContaining({
        idempotencyKey: expect.stringContaining('wallet-ar:user-1:150:'),
      }),
    )
  })

  it('throws when auto-reload charge is not successful', async () => {
    const { service } = createService()
    stripeClientMock.paymentIntents.create.mockResolvedValue({
      id: 'pi_auto_2',
      status: 'requires_payment_method',
      last_payment_error: { message: 'Card declined' },
    })

    await expect(
      service.chargeWalletAutoReload('user-1', 3200, 'pm_123', 'cus_123'),
    ).rejects.toThrow('Auto-reload payment did not succeed')
  })

  it('requires webhook configuration and a signature', async () => {
    const { service } = createService({ STRIPE_SECRET_KEY: 'sk_test_123', STRIPE_WEBHOOK_SECRET: '' })

    await expect(service.handleWebhook(Buffer.from('{}'), 'sig')).rejects.toThrow(
      'Stripe webhooks are not configured',
    )

    const configured = createService().service
    await expect(configured.handleWebhook(Buffer.from('{}'), undefined)).rejects.toThrow(
      'Missing Stripe signature',
    )
  })

  it('dispatches payment_intent.succeeded webhooks to the payment handler', async () => {
    const { service } = createService()
    const event = {
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_123' } },
    }
    stripeClientMock.webhooks.constructEvent.mockReturnValue(event)
    const handler = jest
      .spyOn(service as any, 'handlePaymentIntentSucceeded')
      .mockResolvedValue(undefined)

    await expect(service.handleWebhook(Buffer.from('{}'), 'sig')).resolves.toEqual({
      received: true,
    })

    expect(handler).toHaveBeenCalledWith({ id: 'pi_123' })
  })

  it('returns an existing Stripe customer id when already stored', async () => {
    const { service, userRepo } = createService()
    userRepo.findOne.mockResolvedValue(buildUser({ stripe_customer_id: 'cus_existing' }))

    await expect(service.ensureStripeCustomerId('user-1')).resolves.toBe('cus_existing')
    expect(stripeClientMock.customers.create).not.toHaveBeenCalled()
  })

  it('creates and persists a Stripe customer when one does not exist yet', async () => {
    const { service, userRepo } = createService()
    const user = buildUser({ stripe_customer_id: null })
    userRepo.findOne.mockResolvedValue(user)
    stripeClientMock.customers.create.mockResolvedValue({ id: 'cus_new' })

    await expect(service.ensureStripeCustomerId('user-1')).resolves.toBe('cus_new')
    expect(user.stripe_customer_id).toBe('cus_new')
    expect(userRepo.save).toHaveBeenCalledWith(user)
  })

  it('throws when saving a payment method without a wallet', async () => {
    const { service, userRepo, walletRepo } = createService()
    userRepo.findOne.mockResolvedValue(buildUser({ stripe_customer_id: 'cus_123' }))
    walletRepo.findOne.mockResolvedValue(null)

    await expect(service.savePaymentMethod('user-1', 'pm_123')).rejects.toThrow(
      NotFoundException,
    )
  })

  it('returns null payment preview when no payment method is saved', async () => {
    const { service, walletRepo } = createService()
    walletRepo.findOne.mockResolvedValue(buildWallet({ stripe_payment_method_id: null }))

    await expect(service.getPaymentMethodPreview('user-1')).resolves.toEqual({
      paymentMethod: null,
    })
  })
})
