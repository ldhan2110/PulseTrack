import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useImageUpload } from './useImageUpload';
import * as apiModule from '@/lib/api';
import type { Attachment } from '@/lib/types';

// Minimal editor mock
function makeEditorMock(imageSrc: string) {
  const dispatchedTrs: unknown[] = [];
  const nodes: Array<{ type: { name: string }; attrs: Record<string, unknown>; nodeSize: number }> = [
    { type: { name: 'image' }, attrs: { src: imageSrc, alt: null, width: null }, nodeSize: 1 },
  ];
  const mockTr = {
    setNodeMarkup: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  };
  const nodesBetween = (
    _from: number,
    _to: number,
    fn: (node: unknown, pos: number) => boolean | void,
  ) => {
    for (const node of nodes) {
      const result = fn(node, 0);
      if (result === false) break;
    }
  };
  return {
    view: {
      state: {
        tr: mockTr,
        doc: {
          nodesBetween,
          content: { size: 100 },
        },
      },
      dispatch: vi.fn((tr: unknown) => { dispatchedTrs.push(tr); }),
    },
    chain: () => ({ focus: () => ({ setImage: () => ({ run: vi.fn() }) }) }),
    dispatchedTrs,
    mockTr,
    nodes,
  };
}

const mockAttachment: Attachment = {
  id: 'att-1',
  filename: 'screenshot.png',
  storedName: 'uuid-123.png',
  mimeType: 'image/png',
  size: 50000,
  taskId: 'task-1',
  uploaderId: 'user-1',
  isInline: true,
  createdAt: '2026-04-07T00:00:00Z',
  uploader: { id: 'user-1', username: 'alice', email: 'alice@test.com', name: null, imageUrl: null },
};

describe('useImageUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uploads file and swaps base64 src to static server URL on success', async () => {
    vi.spyOn(apiModule.api, 'uploadAttachment').mockResolvedValue(mockAttachment);
    const editor = makeEditorMock('data:image/png;base64,abc123');

    const { result } = renderHook(() =>
      useImageUpload({ projectId: 'proj-1', entityType: 'task', entityId: 'task-1' }),
    );

    const file = new File(['data'], 'screenshot.png', { type: 'image/png' });

    await act(async () => {
      result.current.handleImagePaste(file, editor as never, 'data:image/png;base64,abc123');
      await result.current.awaitPendingUploads();
    });

    expect(apiModule.api.uploadAttachment).toHaveBeenCalledWith('proj-1', 'task-1', file, true);
    // setNodeMarkup called to swap src → static URL
    expect(editor.mockTr.setNodeMarkup).toHaveBeenCalledWith(
      0,
      undefined,
      expect.objectContaining({ src: '/api/uploads/tasks/task-1/uuid-123.png' }),
    );
  });

  it('removes image and no pending upload remains when upload fails', async () => {
    vi.spyOn(apiModule.api, 'uploadAttachment').mockRejectedValue(new Error('Network error'));
    const editor = makeEditorMock('data:image/png;base64,abc123');

    const { result } = renderHook(() =>
      useImageUpload({ projectId: 'proj-1', entityType: 'task', entityId: 'task-1' }),
    );

    const file = new File(['data'], 'screenshot.png', { type: 'image/png' });

    await act(async () => {
      result.current.handleImagePaste(file, editor as never, 'data:image/png;base64,abc123');
      await result.current.awaitPendingUploads();
    });

    // delete transaction dispatched for failed image
    expect(editor.mockTr.delete).toHaveBeenCalledWith(0, 1);
  });

  it('awaitPendingUploads resolves immediately when no uploads are pending', async () => {
    const { result } = renderHook(() =>
      useImageUpload({ projectId: 'proj-1', entityType: 'task', entityId: 'task-1' }),
    );
    await expect(result.current.awaitPendingUploads()).resolves.toBeUndefined();
  });
});
