import * as Y from 'yjs';
import { LOCAL_ORIGIN } from '../../domain/origins';
import { diffText, transformIndex } from './text-diff';

/**
 * Two-way binding between a <textarea>/<input> and a Y.Text. Local typing becomes minimal
 * insert/delete ops (so concurrent edits merge character by character); remote ops update
 * the field while keeping the caret on the same character.
 */
export function bindTextField(field: HTMLTextAreaElement | HTMLInputElement, text: Y.Text, origin: unknown = LOCAL_ORIGIN): () => void {
  let composing = false;
  let applying = false; // true while our own ops run, so the observer ignores them
  field.value = text.toString();

  const pushLocal = () => {
    const change = diffText(text.toString(), field.value);
    if (!change || !text.doc) return;
    applying = true;
    try {
      text.doc.transact(() => {
        if (change.remove) text.delete(change.index, change.remove);
        if (change.insert) text.insert(change.index, change.insert);
      }, origin);
    } finally {
      applying = false;
    }
  };
  const onInput = () => {
    if (!composing) pushLocal();
  };
  const onCompositionStart = () => (composing = true);
  const onCompositionEnd = () => {
    composing = false;
    pushLocal();
  };
  const observer = (event: Y.YTextEvent) => {
    if (applying) return;
    const focused = field.ownerDocument.activeElement === field;
    const [start, end] = [field.selectionStart ?? 0, field.selectionEnd ?? 0];
    field.value = text.toString();
    if (focused) field.setSelectionRange(transformIndex(event.delta, start), transformIndex(event.delta, end));
  };

  field.addEventListener('input', onInput);
  field.addEventListener('compositionstart', onCompositionStart);
  field.addEventListener('compositionend', onCompositionEnd);
  text.observe(observer);
  return () => {
    field.removeEventListener('input', onInput);
    field.removeEventListener('compositionstart', onCompositionStart);
    field.removeEventListener('compositionend', onCompositionEnd);
    text.unobserve(observer);
  };
}
