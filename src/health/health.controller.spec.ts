import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();
    controller = moduleRef.get(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('check() returns status ok and an ISO timestamp', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    try {
      expect(controller.check()).toEqual({
        status: 'ok',
        timestamp: '2026-01-01T00:00:00.000Z',
      });
    } finally {
      jest.useRealTimers();
    }
  });
});
