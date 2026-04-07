import { useRef, useCallback } from 'react';
import { type Editor } from '@tiptap/react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface UseImageUploadOptions {
  projectId: string;
  taskId: string;
}

export function useImageUpload({ projectId, taskId }: UseImageUploadOptions) {
  // Map from base64 src → Promise resolving to server URL (or rejecting)
  const pendingUploads = useRef<Map<string, Promise<string>>>(new Map());

  const swapSrcInEditor = useCallback(
    (editor: Editor, oldSrc: string, newSrc: string) => {
      const { state, dispatch } = editor.view;
      let foundPos = -1;
      let foundNode: Parameters<Parameters<typeof state.doc.nodesBetween>[2]>[0] | null = null;
      state.doc.nodesBetween(0, state.doc.content.size, (node, pos) => {
        if (node.type.name === 'image' && (node.attrs as Record<string, unknown>).src === oldSrc) {
          foundPos = pos;
          foundNode = node;
          return false; // stop traversal
        }
      });
      if (foundPos >= 0 && foundNode !== null) {
        const tr = state.tr.setNodeMarkup(foundPos, undefined, {
          ...(foundNode.attrs as Record<string, unknown>),
          src: newSrc,
        });
        dispatch(tr);
      }
    },
    [],
  );

  const removeImageFromEditor = useCallback(
    (editor: Editor, src: string) => {
      const { state, dispatch } = editor.view;
      let foundPos = -1;
      let foundNodeSize = 0;
      state.doc.nodesBetween(0, state.doc.content.size, (node, pos) => {
        if (node.type.name === 'image' && (node.attrs as Record<string, unknown>).src === src) {
          foundPos = pos;
          foundNodeSize = node.nodeSize;
          return false; // stop traversal
        }
      });
      if (foundPos >= 0) {
        const tr = state.tr.delete(foundPos, foundPos + foundNodeSize);
        dispatch(tr);
      }
    },
    [],
  );

  /**
   * Called after the editor has already inserted the image as base64.
   * Fires the upload in the background and swaps src when done.
   */
  const handleImagePaste = useCallback(
    (file: File, editor: Editor, base64Src: string) => {
      const uploadPromise = api
        .uploadAttachment(projectId, taskId, file, true)
        .then((attachment) => {
          const serverUrl = `/api/uploads/tasks/${taskId}/${attachment.storedName}`;
          swapSrcInEditor(editor, base64Src, serverUrl);
          pendingUploads.current.delete(base64Src);
          return serverUrl;
        })
        .catch((err: unknown) => {
          removeImageFromEditor(editor, base64Src);
          pendingUploads.current.delete(base64Src);
          toast.error('Image upload failed — please try again.');
          throw err;
        });

      pendingUploads.current.set(base64Src, uploadPromise);
    },
    [projectId, taskId, swapSrcInEditor, removeImageFromEditor],
  );

  /** Await all in-flight uploads. Call before getHTML() on save. */
  const awaitPendingUploads = useCallback(async () => {
    const pending = Array.from(pendingUploads.current.values());
    if (pending.length > 0) {
      await Promise.allSettled(pending);
    }
  }, []);

  return { handleImagePaste, awaitPendingUploads };
}
