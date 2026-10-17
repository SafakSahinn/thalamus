// Yorumlar (Notion'daki gibi): metinde seçilen bir yere ya da sayfanın geneline yorum; yanıtlar; çözüldü işareti.
// Yorumlar notun gizli alanında (props.__comments) durur, böylece notla birlikte Drive'a eşitlenir.
// Metindeki işaret yalnızca yorumun kimliğini taşır (editörde "comment" işareti).

import { Mark, mergeAttributes } from '@tiptap/core';
import { create } from 'zustand';
import { setProp, uid, useStore } from './store';

export interface Reply {
  id: string;
  text: string;
  created_at: string;
}

export interface Comment extends Reply {
  /** Seçilen metin (sayfa yorumunda yok) */
  quote?: string;
  resolved?: boolean;
  replies: Reply[];
}

export const commentsOf = (noteId: string): Comment[] => {
  const v = useStore.getState().notes[noteId]?.props.__comments;
  return Array.isArray(v) ? (v as Comment[]) : [];
};

const save = (noteId: string, list: Comment[]) => setProp(noteId, '__comments', list.length ? list : undefined);

export function addComment(noteId: string, text: string, quote?: string, id = uid()): string {
  save(noteId, [...commentsOf(noteId), { id, text, quote, created_at: new Date().toISOString(), replies: [] }]);
  return id;
}

export function replyComment(noteId: string, id: string, text: string) {
  save(noteId, commentsOf(noteId).map((c) => (c.id === id ? { ...c, replies: [...c.replies, { id: uid(), text, created_at: new Date().toISOString() }] } : c)));
}

export function resolveComment(noteId: string, id: string, resolved: boolean) {
  save(noteId, commentsOf(noteId).map((c) => (c.id === id ? { ...c, resolved } : c)));
}

export function deleteComment(noteId: string, id: string) {
  save(noteId, commentsOf(noteId).filter((c) => c.id !== id));
}

/** Yorum paneli: hangi notun paneli açık, hangi yorum seçili */
export const useCommentPanel = create<{ noteId: string | null; focus: string | null }>(() => ({ noteId: null, focus: null }));
export const openComments = (noteId: string, focus: string | null = null) => useCommentPanel.setState({ noteId, focus });
export const closeComments = () => useCommentPanel.setState({ noteId: null, focus: null });

/** Metindeki yorum işareti. Vurgusu yalnızca açık (çözülmemiş) yorumlar için CSS ile verilir. */
export const CommentMark = Mark.create({
  name: 'comment',
  inclusive: false,
  excludes: '',
  addAttributes: () => ({
    id: { default: null, parseHTML: (el) => el.getAttribute('data-comment'), renderHTML: (a) => (a.id ? { 'data-comment': a.id } : {}) },
  }),
  parseHTML: () => [{ tag: 'span[data-comment]' }],
  renderHTML: ({ HTMLAttributes }) => ['span', mergeAttributes(HTMLAttributes, { class: 'comment-mark' })],
});
