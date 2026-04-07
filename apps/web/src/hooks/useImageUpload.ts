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
      state.doc.descendants((node, pos) => {
        if (node.type.name === 'image' && (node.attrs as Record<string, unknown>).src === oldSrc) {
          const tr = state.tr.setNodeMarkup(pos, undefined, {
            ...(node.attrs as Record<string, unknown>),
            src: newSrc,
          });
          dispatch(tr);
          return false; // stop after first match
        }
      });
    },
    [],
  );

  const removeImageFromEditor = useCallback(
    (editor: Editor, src: string) => {
      const { state, dispatch } = editor.view;
      state.doc.descendants((node, pos) => {
        if (node.type.name === 'image' && (node.attrs as Record<string, unknown>).src === src) {
          const tr = state.tr.delete(pos, pos + node.nodeSize);
          dispatch(tr);
          return false;
        }
      });
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
        .uploadAttachment(projectId, taskId, file)
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
