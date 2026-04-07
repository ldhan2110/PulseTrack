import { useRef, useCallback } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';

function ResizableImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startX.current = e.clientX;
      startWidth.current = imageRef.current?.offsetWidth ?? 300;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX.current;
        const newWidth = Math.max(50, startWidth.current + delta);
        if (imageRef.current) {
          imageRef.current.style.width = `${newWidth}px`;
        }
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        const delta = upEvent.clientX - startX.current;
        const newWidth = Math.max(50, startWidth.current + delta);
        updateAttributes({ width: newWidth });
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [updateAttributes],
  );

  return (
    <NodeViewWrapper className="inline-block relative group/img my-2">
      <img
        ref={imageRef}
        src={node.attrs.src as string}
        alt={(node.attrs.alt as string) ?? ''}
        title={(node.attrs.title as string) ?? undefined}
        style={{ width: node.attrs.width ? `${node.attrs.width as number}px` : undefined }}
        className={`max-w-full rounded-md block ${selected ? 'ring-2 ring-primary' : ''}`}
        draggable={false}
      />
      <div
        className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-8 bg-primary/60 rounded-sm cursor-col-resize opacity-0 group-hover/img:opacity-100 transition-opacity"
        onMouseDown={handleMouseDown}
        aria-label="Resize image"
      />
    </NodeViewWrapper>
  );
}

export const ResizableImage = Node.create({
  name: 'image',
  group: 'inline',
  inline: true,
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      width: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'img[src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});
