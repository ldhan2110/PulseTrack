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

export function MessageAttachment({
  attachment,
  own = false,
}: {
  attachment: Att;
  own?: boolean;
}) {
  if (isImage(attachment.mimeType)) return <ImageAttachment attachment={attachment} />;
  return <FileChip attachment={attachment} own={own} />;
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
        <div className="absolute right-1 top-1 hidden gap-1 group-hover/att:flex">
          <button
            onClick={copy}
            aria-label="Copy image"
            className="flex items-center gap-1 rounded bg-background/90 px-1.5 py-0.5 text-[11px] shadow"
          >
            <Copy className="size-3" /> Copy
          </button>
          <button
            onClick={download}
            aria-label="Download image"
            className="flex items-center gap-1 rounded bg-background/90 px-1.5 py-0.5 text-[11px] shadow"
          >
            <Download className="size-3" /> Save
          </button>
        </div>
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

function FileChip({ attachment, own = false }: { attachment: Att; own?: boolean }) {
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
  const chip = own
    ? 'bg-primary-foreground/15 hover:bg-primary-foreground/25'
    : 'bg-background/70 hover:bg-background';
  const sub = own ? 'text-primary-foreground/70' : 'text-muted-foreground';
  return (
    <button
      onClick={download}
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${chip}`}
    >
      <Icon className={`size-3.5 shrink-0 ${sub}`} />
      <span className="max-w-[150px] truncate">{attachment.filename}</span>
      <span className={sub}>{formatSize(attachment.size)}</span>
      <Download className={`size-3 ${sub}`} />
    </button>
  );
}
