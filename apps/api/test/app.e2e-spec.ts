import request from 'supertest'
import { AppController } from '../src/app.controller'
import { AppService } from '../src/app.service'
import { closeHttpApp, createHttpApp } from './helpers/testing'

describe('AppController (e2e)', () => {
  it('/ (GET)', async () => {
    const { app } = await createHttpApp({
      controllers: [AppController],
      providers: [AppService],
    })

    await request(app.getHttpServer()).get('/').expect(200).expect('Hello World!')

    await closeHttpApp(app)
  })
})
