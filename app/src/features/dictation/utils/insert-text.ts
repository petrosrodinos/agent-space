type TextField = HTMLTextAreaElement | HTMLInputElement;

/**
 * Inserts dictated text at the caret (replacing any selection), with a space on either side where needed, and fires
 * a native `input` event so React `onChange` handlers and form libraries see it like typed text.
 */
export function insertDictatedText(el: TextField, text: string) {
  const value = el.value;
  // The caret only counts while the user is in the field; otherwise dictation appends.
  const focused = document.activeElement === el;
  const start = focused ? (el.selectionStart ?? value.length) : value.length;
  const end = focused ? (el.selectionEnd ?? value.length) : value.length;
  const before = value.slice(0, start);
  const after = value.slice(end);
  const lead = before && !/\s$/.test(before) ? " " : "";
  const trail = after && !/^\s/.test(after) ? " " : "";
  let insert = `${lead}${text}${trail}`;
  if (el.maxLength > 0) insert = insert.slice(0, Math.max(0, el.maxLength - before.length - after.length));
  if (!insert) return;
  const next = before + insert + after;
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, next);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  const caret = before.length + insert.length;
  el.focus();
  el.setSelectionRange(caret, caret);
}
