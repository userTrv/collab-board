import * as Y from 'yjs';
import { diffText, transformIndex } from './text-diff';
import { bindTextField } from './y-text-binding';

describe('diffText', () => {
  it('finds the single edited range', () => {
    expect(diffText('abc', 'abc')).toBeNull();
    expect(diffText('hello', 'hello!')).toEqual({ index: 5, remove: 0, insert: '!' });
    expect(diffText('hello', 'hxllo')).toEqual({ index: 1, remove: 1, insert: 'x' });
    expect(diffText('hello world', 'hello')).toEqual({ index: 5, remove: 6, insert: '' });
    expect(diffText('aaa', 'aaaa')).toEqual({ index: 3, remove: 0, insert: 'a' });
  });
});

describe('transformIndex', () => {
  it('shifts the caret for remote inserts/deletes before it only', () => {
    expect(transformIndex([{ insert: 'abc' }], 2)).toBe(5);
    expect(transformIndex([{ retain: 5 }, { insert: 'abc' }], 2)).toBe(2);
    expect(transformIndex([{ delete: 2 }], 4)).toBe(2);
    expect(transformIndex([{ retain: 1 }, { delete: 10 }], 4)).toBe(1);
  });
});

describe('bindTextField', () => {
  it('turns typing into Y.Text ops and keeps the caret stable on remote edits', () => {
    const local = new Y.Doc();
    const remote = new Y.Doc();
    local.on('update', (u: Uint8Array) => Y.applyUpdate(remote, u, 'net'));
    remote.on('update', (u: Uint8Array, origin: unknown) => origin !== 'net' && Y.applyUpdate(local, u, 'net'));
    const text = local.getText('d');
    const field = document.createElement('textarea');
    document.body.append(field);
    const unbind = bindTextField(field, text);

    field.value = 'world';
    field.dispatchEvent(new Event('input'));
    expect(remote.getText('d').toString()).toBe('world');

    field.focus();
    field.setSelectionRange(5, 5);
    remote.getText('d').insert(0, 'hello ');
    expect(field.value).toBe('hello world');
    expect(field.selectionStart).toBe(11);

    unbind();
    field.remove();
  });
});
