import { ResourcesPublicController } from './resources-public.controller'
import { createRepositoryMock } from '../../test/helpers/testing'

describe('ResourcesPublicController', () => {
  it('lists only published resource items in the expected order', async () => {
    const repo = createRepositoryMock<any>()
    repo.find.mockResolvedValue([{ id: 'resource-1', title: 'Connect your CRM' }])
    const controller = new ResourcesPublicController(repo as any)

    await expect(controller.listPublished()).resolves.toEqual([
      { id: 'resource-1', title: 'Connect your CRM' },
    ])

    expect(repo.find).toHaveBeenCalledWith({
      where: { is_published: true },
      order: { sort_order: 'ASC', created_at: 'DESC' },
    })
  })
})
