// apps/web/src/components/tasks/AttachmentList.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import type { Attachment } from '@/lib/types';
import * as attachmentHooks from '@/hooks/useAttachments';

vi.mock('@/lib/api', () => ({
  api: {
    downloadAttachment: vi.fn().mockResolvedValue(new Blob()),
  },
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

const imageAttachment: Attachment = {
  id: 'att-img',
  filename: 'photo.png',
  storedName: 'uuid-img.png',
  mimeType: 'image/png',
  size: 8000,
  taskId: 'task-1',
  uploaderId: 'user-1',
  createdAt: '2026-04-07T00:00:00Z',
  isInline: false,
  uploader: { id: 'user-1', username: 'alice', email: 'alice@test.com', name: null, imageUrl: null },
};

const fileAttachment: Attachment = {
  id: 'att-file',
  filename: 'report.pdf',
  storedName: 'uuid-pdf.pdf',
  mimeType: 'application/pdf',
  size: 20000,
  taskId: 'task-1',
  uploaderId: 'user-1',
  isInline: false,
  createdAt: '2026-04-07T00:00:00Z',
  uploader: { id: 'user-1', username: 'alice', email: 'alice@test.com', name: null, imageUrl: null },
};

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('AttachmentList image preview', () => {
  beforeEach(() => {
    vi.spyOn(attachmentHooks, 'useAttachments').mockReturnValue({
      data: [imageAttachment, fileAttachment],
    } as unknown as ReturnType<typeof attachmentHooks.useAttachments>);
    vi.spyOn(attachmentHooks, 'useUploadAttachment').mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof attachmentHooks.useUploadAttachment>);
    vi.spyOn(attachmentHooks, 'useDeleteAttachment').mockReturnValue({
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof attachmentHooks.useDeleteAttachment>);
  });

  it('renders thumbnail img for image attachments', async () => {
    const { AttachmentList } = await import('./AttachmentList');
    render(
      <AttachmentList
        projectId="proj-1"
        taskId="task-1"
        currentUserId="user-1"
        canManage={false}
      />,
      { wrapper },
    );
    // Thumbnail img src = static URL
    const thumb = screen.getByRole('img', { name: /photo\.png/i });
    expect(thumb).toHaveAttribute('src', '/api/uploads/tasks/task-1/uuid-img.png');
  });

  it('renders Preview button only for image attachments', async () => {
    const { AttachmentList } = await import('./AttachmentList');
    render(
      <AttachmentList
        projectId="proj-1"
        taskId="task-1"
        currentUserId="user-1"
        canManage={false}
      />,
      { wrapper },
    );
    const previewButtons = screen.getAllByRole('button', { name: /preview/i });
    expect(previewButtons).toHaveLength(1); // only for image attachment
  });

  it('opens ImagePreviewModal when Preview is clicked', async () => {
    const { AttachmentList } = await import('./AttachmentList');
    render(
      <AttachmentList
        projectId="proj-1"
        taskId="task-1"
        currentUserId="user-1"
        canManage={false}
      />,
      { wrapper },
    );
    fireEvent.click(screen.getByRole('button', { name: /preview photo\.png/i }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('photo.png')).toBeInTheDocument();
  });
});
