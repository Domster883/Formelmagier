/** Mini-Helfer für DOM-Oberflächen (Dialoge, Menüs) über dem Phaser-Canvas */

type Child = Node | string | null | undefined | false;
type Attrs = Record<string, string | number | boolean | EventListener | undefined>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else if (k === 'class') {
      el.className = String(v);
    } else if (k === 'html') {
      el.innerHTML = String(v);
    } else if (v === true) {
      el.setAttribute(k, '');
    } else {
      el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el: HTMLElement, children: (Child | Child[])[]) {
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

// ---------------------------------------------------------------------------
// Modale Fenster (Stapel)
// ---------------------------------------------------------------------------

interface ModalEntry {
  el: HTMLElement;
  onClose?: () => void;
  closable: boolean;
}
const stack: ModalEntry[] = [];

export function isModalOpen(): boolean {
  return stack.length > 0;
}

export interface ModalOptions {
  title?: string;
  wide?: boolean;
  closable?: boolean;
  onClose?: () => void;
  className?: string;
}

export interface ModalHandle {
  body: HTMLElement;
  close: () => void;
  setTitle: (t: string) => void;
}

export function openModal(opts: ModalOptions = {}): ModalHandle {
  const root = document.getElementById('overlay')!;
  const titleEl = h('h2', { class: 'modal-title' }, opts.title ?? '');
  const body = h('div', { class: 'modal-body' });
  const closable = opts.closable !== false;
  const closeBtn = closable ? h('button', { class: 'modal-close', title: 'Schließen (Esc)', 'aria-label': 'Schließen' }, '✕') : null;
  const box = h('div', { class: `modal ${opts.wide ? 'wide' : ''} ${opts.className ?? ''}`, role: 'dialog' }, h('div', { class: 'modal-head' }, titleEl, closeBtn), body);
  const backdrop = h('div', { class: 'backdrop' }, box);
  root.append(backdrop);
  const entry: ModalEntry = { el: backdrop, onClose: opts.onClose, closable };
  stack.push(entry);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    const i = stack.indexOf(entry);
    if (i >= 0) stack.splice(i, 1);
    backdrop.remove();
    entry.onClose?.();
  };
  closeBtn?.addEventListener('click', close);
  (entry as ModalEntry & { close: () => void }).close = close;
  setTimeout(() => {
    const f = box.querySelector<HTMLElement>('[autofocus], input, button.primary');
    f?.focus();
  }, 30);
  return { body, close, setTitle: (t) => (titleEl.textContent = t) };
}

export function closeTopModal(): boolean {
  const top = stack[stack.length - 1] as (ModalEntry & { close?: () => void }) | undefined;
  if (!top || !top.closable) return false;
  top.close?.();
  return true;
}

export function closeAllModals() {
  while (stack.length) {
    const top = stack[stack.length - 1] as ModalEntry & { close?: () => void };
    top.close?.();
  }
}

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------

export function toast(text: string, kind: 'info' | 'good' | 'bad' | 'gold' = 'info', ms = 2600) {
  const root = document.getElementById('toasts')!;
  const el = h('div', { class: `toast ${kind}` }, text);
  root.append(el);
  setTimeout(() => el.classList.add('fade'), ms - 400);
  setTimeout(() => el.remove(), ms);
}

/** Einfache Dialogsequenz (z. B. Mentor) – Zeile für Zeile weiterklicken */
export function showDialog(speaker: string, lines: string[], opts: { title?: string; onDone?: () => void; portrait?: string } = {}) {
  let i = 0;
  const m = openModal({ title: opts.title ?? speaker, onClose: () => opts.onDone?.() });
  const text = h('p', { class: 'dialog-text' });
  const counter = h('span', { class: 'dialog-counter' });
  const next = h('button', { class: 'primary', autofocus: true }, 'Weiter ▸');
  const render = () => {
    text.textContent = lines[i];
    counter.textContent = `${i + 1} / ${lines.length}`;
    next.textContent = i === lines.length - 1 ? 'Verstanden ✓' : 'Weiter ▸';
  };
  next.addEventListener('click', () => {
    if (i < lines.length - 1) {
      i++;
      render();
      next.focus();
    } else m.close();
  });
  m.body.append(
    h('div', { class: 'dialog' }, h('div', { class: `portrait ${opts.portrait ?? ''}` }), h('div', { class: 'dialog-main' }, h('div', { class: 'speaker' }, speaker), text)),
    h('div', { class: 'row end' }, counter, next),
  );
  render();
  return m;
}
