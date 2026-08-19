/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { JSONContent } from '@tiptap/core';

const EMPTY_DOC: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

export function isTiptapDoc(value: unknown): value is JSONContent {
  return Boolean(value && typeof value === 'object' && (value as JSONContent).type === 'doc');
}

/** Parse stored editor value (Tiptap JSON, legacy HTML, or plain text). */
export function parseTiptapContent(value: string): JSONContent | string {
  if (!value?.trim()) return EMPTY_DOC;
  try {
    const parsed: unknown = JSON.parse(value);
    if (isTiptapDoc(parsed)) return parsed;
  } catch {
    // Previous Quill HTML or plain text — Tiptap can parse it as content.
  }
  return value;
}

export function serializeTiptapJson(doc: JSONContent, isEmpty = false): string {
  if (isEmpty) return '';
  return JSON.stringify(doc);
}

function extractText(node: JSONContent): string {
  if (node.type === 'text') return node.text || '';
  const children = node.content ?? [];
  const joined = children.map(extractText).join(node.type === 'listItem' ? '' : node.type === 'hardBreak' ? '\n' : '');
  if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'codeBlock' || node.type === 'blockquote') {
    return `${joined}\n`;
  }
  if (node.type === 'listItem') return `• ${joined}\n`;
  return joined;
}

/** Plain text for UI / export consumers that still expect a readable string. */
export function tiptapContentToPlainText(value: string | null | undefined): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (isTiptapDoc(parsed)) return extractText(parsed).replace(/\n+$/g, '').trim();
  } catch {
    return trimmed.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || trimmed;
  }
  return trimmed;
}
