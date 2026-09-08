// apps/web/src/components/editor/mentionExtension.ts
// Shared @mention extension for the comment composer and the edit editor.
// Both must use the SAME parseHTML/renderHTML so stored mentions round-trip
// (previously the edit editor lacked Mention entirely and stripped chips).
import Mention from '@tiptap/extension-mention';
import { ReactRenderer } from '@tiptap/react';
import tippy, { type Instance } from 'tippy.js';
import { MentionList, type MentionSuggestionRef } from './MentionSuggestion';

export type MentionMember = { id: string; label: string; imageUrl?: string | null };

// ponytail: members defaults to [] — edit mode passes none, so it preserves
// existing chips but shows no picker. Pass members to enable the @ suggestion.
export function buildMention(members: MentionMember[] = []) {
  return Mention.extend({
    addAttributes() {
      return {
        id: {
          default: null,
          parseHTML: (el) => el.getAttribute('data-mention-id'),
          renderHTML: (attrs) => (attrs.id ? { 'data-mention-id': attrs.id } : {}),
        },
        label: {
          default: null,
          parseHTML: (el) => el.textContent?.replace(/^@/, '') ?? null,
          renderHTML: () => ({}),
        },
      };
    },
    parseHTML() {
      return [{ tag: 'span.mention[data-mention-id]' }];
    },
    renderHTML({ node }) {
      return ['span', { class: 'mention', 'data-mention-id': node.attrs.id }, `@${node.attrs.label}`];
    },
  }).configure({
    HTMLAttributes: { class: 'mention' },
    suggestion: {
      items: ({ query }: { query: string }) =>
        members.filter((m) => m.label.toLowerCase().includes(query.toLowerCase())),
      render: () => {
        let component: ReactRenderer<MentionSuggestionRef>;
        let popup: Instance[];
        return {
          onStart: (props: any) => {
            component = new ReactRenderer(MentionList, { props, editor: props.editor });
            popup = tippy('body', {
              getReferenceClientRect: props.clientRect as () => DOMRect,
              appendTo: () => document.body,
              content: component.element,
              showOnCreate: true,
              interactive: true,
              trigger: 'manual',
              placement: 'bottom-start',
            });
          },
          onUpdate: (props: any) => {
            component.updateProps(props);
            popup[0]?.setProps({ getReferenceClientRect: props.clientRect as () => DOMRect });
          },
          onKeyDown: (props: any) => component.ref?.onKeyDown(props) ?? false,
          onExit: () => { popup[0]?.destroy(); component.destroy(); },
        };
      },
    },
  });
}
