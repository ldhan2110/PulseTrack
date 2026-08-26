import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestcaseScriptService } from './testcase-script.service';
import { NotFoundException } from '@nestjs/common';

describe('TestcaseScriptService', () => {
  let service: TestcaseScriptService;

  const mockQueue = {
    add: vi.fn(),
    getJob: vi.fn(),
  };
  const mockPrisma = {
    testCase: {
      findUnique: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TestcaseScriptService(mockQueue as any, mockPrisma as any);
    mockPrisma.testCase.findUnique.mockResolvedValue({ projectId: 'proj-1' });
  });

  describe('enqueue', () => {
    it('enqueues with a deterministic per-test-case jobId and returns it', async () => {
      mockQueue.add.mockResolvedValue({ id: 'script-tc-1' });

      const result = await service.enqueue('tc-1');

      expect(result.jobId).toBe('script-tc-1');
      expect(mockQueue.add).toHaveBeenCalledWith(
        'generate',
        { testCaseId: 'tc-1', projectId: 'proj-1' },
        { jobId: 'script-tc-1', removeOnComplete: true, removeOnFail: true },
      );
    });

    it('re-enqueue while active resolves to the same jobId (dedup)', async () => {
      // BullMQ rejects a duplicate jobId; add() resolves to that same job either way.
      mockQueue.add.mockResolvedValue({ id: 'script-tc-1' });

      const first = await service.enqueue('tc-1');
      const second = await service.enqueue('tc-1');

      expect(first.jobId).toBe('script-tc-1');
      expect(second.jobId).toBe('script-tc-1');
    });

    it('throws when the test case does not exist', async () => {
      mockPrisma.testCase.findUnique.mockResolvedValue(null);
      await expect(service.enqueue('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getResult', () => {
    it('reports not-found jobs as failed', async () => {
      mockQueue.getJob.mockResolvedValue(null);
      const r = await service.getResult('script-tc-1');
      expect(r.status).toBe('failed');
    });

    it('returns the latest step while active', async () => {
      mockQueue.getJob.mockResolvedValue({
        getState: vi.fn().mockResolvedValue('active'),
        progress: { step: '✍️ Writing script…' },
      });
      const r = await service.getResult('script-tc-1');
      expect(r).toEqual({ status: 'active', step: '✍️ Writing script…' });
    });
  });
});
