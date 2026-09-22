// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { MessageAttachment as Att } from '@/lib/types';

vi.mock('@/lib/api', () => ({
  api: {
    downloadChatAttachment: vi.fn(async () => new Blob(['x'], { type: 'image/png' })),
  },
}));

import { MessageAttachment } from './MessageAttachment';

beforeEach(() => {
  // jsdom lacks these
  URL.createObjectURL = vi.fn(() => 'blob:mock');
  URL.revokeObjectURL = vi.fn();
});

const base = { id: 'a1', messageId: 'm1', storedName: 's', size: 1234, createdAt: '' };

describe('MessageAttachment', () => {
  it('renders an inline <img> with a copy button for image/png', async () => {
    const att: Att = { ...base, filename: 'pic.png', mimeType: 'image/png' };
    render(<MessageAttachment attachment={att} />);
    await waitFor(() => expect(screen.getByRole('img')).toBeTruthy());
    expect(screen.getByLabelText('Copy image')).toBeTruthy();
  });

  it('renders a download chip (no <img>) for application/pdf', () => {
    const att: Att = { ...base, filename: 'doc.pdf', mimeType: 'application/pdf' };
    render(<MessageAttachment attachment={att} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('doc.pdf')).toBeTruthy();
  });
});
