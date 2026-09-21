import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

export interface EmojiPickerProps {
  onEmojiSelect: (e: { native: string }) => void;
  previewPosition?: 'none' | 'top' | 'bottom';
}

/**
 * Wraps emoji-mart so `lazy(() => import('./EmojiPickerLazy'))` splits the
 * ~1MB emoji data + picker into a chunk loaded only when a picker opens.
 * Shared by Composer and ReactionBar → one chunk, not two.
 */
export default function EmojiPickerInner({
  onEmojiSelect,
  previewPosition,
}: EmojiPickerProps) {
  return (
    <Picker
      data={data}
      theme="light"
      previewPosition={previewPosition}
      onEmojiSelect={onEmojiSelect}
    />
  );
}
