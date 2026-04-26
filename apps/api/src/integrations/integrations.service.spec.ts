import { BadRequestException } from '@nestjs/common'
import { IntegrationProvider } from '../../common/enums/integration-provider.enum'
import { IntegrationStatus } from '../../common/enums/integration-status.enum'
import { IntegrationsService } from './integrations.service'
import { createRepositoryMock } from '../../test/helpers/testing'

describe('IntegrationsService', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  function createService() {
    const integrationRepo = createRepositoryMock<any>()
    const service = new IntegrationsService(integrationRepo as any)
    return { service, integrationRepo }
  }

  it('rejects invalid webhook URLs', async () => {
    const { service, integrationRepo } = createService()
    integrationRepo.findOne.mockResolvedValue({
      id: 'integration-1',
      user: { id: 'user-1' },
      provider: IntegrationProvider.CUSTOM_WEBHOOK,
      status: IntegrationStatus.DISCONNECTED,
      config: {},
    })

    await expect(service.setWebhookUrl('user-1', 'not-a-url')).rejects.toThrow(
      BadRequestException,
    )
  })

  it('requires a saved webhook URL before sending a test event', async () => {
    const { service, integrationRepo } = createService()
    integrationRepo.findOne.mockResolvedValue({
      id: 'integration-1',
      user: { id: 'user-1' },
      provider: IntegrationProvider.CUSTOM_WEBHOOK,
      status: IntegrationStatus.DISCONNECTED,
      config: {},
    })

    await expect(service.testWebhook('user-1')).rejects.toThrow('Save a webhook URL first')
  })

  it('skips outbound events when no webhook URL is configured', async () => {
    const { service, integrationRepo } = createService()
    integrationRepo.findOne.mockResolvedValue({
      id: 'integration-1',
      user: { id: 'user-1' },
      provider: IntegrationProvider.CUSTOM_WEBHOOK,
      status: IntegrationStatus.DISCONNECTED,
      config: {},
    })

    await expect(
      service.emitCustomWebhookEvent('user-1', 'lead_purchased', { lead_id: 'lead-1' }),
    ).resolves.toEqual({ delivered: false, skipped: true, status: null })
  })

  it('marks the webhook as connected after a successful delivery', async () => {
    const { service, integrationRepo } = createService()
    const row = {
      id: 'integration-1',
      user: { id: 'user-1' },
      provider: IntegrationProvider.CUSTOM_WEBHOOK,
      status: IntegrationStatus.DISCONNECTED,
      config: { webhookUrl: 'https://hooks.example.com/newleey' },
      last_sync_at: null,
    }
    integrationRepo.findOne.mockResolvedValue(row)
    integrationRepo.save.mockImplementation(async (value) => value)
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 } as any)

    const result = await service.emitCustomWebhookEvent('user-1', 'lead_purchased', {
      lead_id: 'lead-1',
    })

    expect(result).toEqual({ delivered: true, skipped: false, status: 200 })
    expect(row.status).toBe(IntegrationStatus.CONNECTED)
    expect(integrationRepo.save).toHaveBeenCalledWith(row)
  })

  it('marks the webhook as errored when delivery fails', async () => {
    const { service, integrationRepo } = createService()
    const row = {
      id: 'integration-1',
      user: { id: 'user-1' },
      provider: IntegrationProvider.CUSTOM_WEBHOOK,
      status: IntegrationStatus.CONNECTED,
      config: { webhookUrl: 'https://hooks.example.com/newleey' },
    }
    integrationRepo.findOne.mockResolvedValue(row)
    integrationRepo.save.mockImplementation(async (value) => value)
    global.fetch = jest.fn().mockRejectedValue(new Error('timeout'))

    const result = await service.emitCustomWebhookEvent('user-1', 'lead_purchased', {
      lead_id: 'lead-1',
    })

    expect(result).toEqual({ delivered: false, skipped: false, status: null })
    expect(row.status).toBe(IntegrationStatus.ERROR)
  })
})
