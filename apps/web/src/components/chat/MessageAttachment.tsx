import { useEffect, useState } from 'react';
import { FileText, File as FileIcon, Copy, Download } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { MessageAttachment as Att } from '@/lib/types';

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

const isImage = (mime: string) => mime.startsWith('image/');

export function MessageAttachment({ attachment }: { attachment: Att }) {
  if (isImage(attachment.mimeType)) return <ImageAttachment attachment={attachment} />;
  return <FileChip attachment={attachment} />;
}

function ImageAttachment({ attachment }: { attachment: Att }) {
  const [url, setUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    void api
      .downloadChatAttachment(attachment.id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.id]);

  async function copy() {
    try {
      const blob = await api.downloadChatAttachment(attachment.id);
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type || attachment.mimeType]: blob }),
      ]);
      toast.success('Image copied');
    } catch {
      toast.error('Copy failed');
    }
  }

  return (
    <>
      <div className="group/att relative inline-block">
        {url ? (
          <img
            src={url}
            alt={attachment.filename}
            onClick={() => setZoom(true)}
            className="max-h-48 max-w-[240px] cursor-zoom-in rounded-md object-cover"
          />
        ) : (
          <div className="h-32 w-40 animate-pulse rounded-md bg-muted" />
        )}
        <button
          onClick={copy}
          aria-label="Copy image"
          className="absolute right-1 top-1 hidden items-center gap-1 rounded bg-background/90 px-1.5 py-0.5 text-[11px] shadow group-hover/att:flex"
        >
          <Copy className="size-3" /> Copy
        </button>
      </div>
      {zoom && url && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setZoom(false)}
        >
          <img src={url} alt={attachment.filename} className="max-h-full max-w-full rounded" />
        </div>
      )}
    </>
  );
}

function FileChip({ attachment }: { attachment: Att }) {
  const Icon = attachment.mimeType === 'application/pdf' ? FileText : FileIcon;
  async function download() {
    try {
      const blob = await api.downloadChatAttachment(attachment.id);
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = attachment.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch {
      toast.error('Download failed');
    }
  }
  return (
    <button
      onClick={download}
      className="flex items-center gap-2 rounded-md bg-muted/60 px-2 py-1.5 text-xs hover:bg-muted"
    >
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="max-w-[150px] truncate">{attachment.filename}</span>
      <span className="text-muted-foreground">{formatSize(attachment.size)}</span>
      <Download className="size-3 text-muted-foreground" />
    </button>
  );
}
