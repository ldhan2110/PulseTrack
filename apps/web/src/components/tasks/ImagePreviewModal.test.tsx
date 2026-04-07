// apps/web/src/components/tasks/ImagePreviewModal.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImagePreviewModal } from './ImagePreviewModal';
import type { Attachment } from '@/lib/types';

vi.mock('@/lib/api', () => ({
  api: {
    downloadAttachment: vi.fn().mockResolvedValue(new Blob(['img'], { type: 'image/png' })),
  },
}));

const mockAttachment: Attachment = {
  id: 'att-1',
  filename: 'screenshot.png',
  storedName: 'uuid-abc.png',
  mimeType: 'image/png',
  size: 12345,
  taskId: 'task-1',
  uploaderId: 'user-1',
  createdAt: '2026-04-07T00:00:00Z',
  uploader: { id: 'user-1', username: 'alice', email: 'alice@test.com' },
};

describe('ImagePreviewModal', () => {
  it('renders image with static URL when open', () => {
    render(
      <ImagePreviewModal
        attachment={mockAttachment}
        projectId="proj-1"
        taskId="task-1"
        open={true}
        onClose={vi.fn()}
      />,
    );
    const img = screen.getByRole('img', { name: /screenshot\.png/i });
    expect(img).toHaveAttribute('src', '/api/uploads/tasks/task-1/uuid-abc.png');
  });

  it('shows filename in dialog title', () => {
    render(
      <ImagePreviewModal
        attachment={mockAttachment}
        projectId="proj-1"
        taskId="task-1"
        open={true}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('screenshot.png')).toBeInTheDocument();
  });

  it('shows Download button', () => {
    render(
      <ImagePreviewModal
        attachment={mockAttachment}
        projectId="proj-1"
        taskId="task-1"
        open={true}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
  });

  it('calls onClose when dialog is closed', () => {
    const onClose = vi.fn();
    render(
      <ImagePreviewModal
        attachment={mockAttachment}
        projectId="proj-1"
        taskId="task-1"
        open={true}
        onClose={onClose}
      />,
    );
    // Press Escape to close
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when attachment is null', () => {
    const { container } = render(
      <ImagePreviewModal
        attachment={null}
        projectId="proj-1"
        taskId="task-1"
        open={false}
        onClose={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
