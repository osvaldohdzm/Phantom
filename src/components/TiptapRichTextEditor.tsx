/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import { useEffect, useMemo, useRef } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import Placeholder from '@tiptap/extension-placeholder';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  MenuButtonBold,
  MenuButtonBulletedList,
  MenuButtonCodeBlock,
  MenuButtonItalic,
  MenuButtonOrderedList,
  MenuButtonRemoveFormatting,
  MenuButtonStrikethrough,
  MenuButtonUnderline,
  MenuControlsContainer,
  RichTextEditor,
  RichTextEditorProvider,
  RichTextField,
} from 'mui-tiptap';
import { useTheme } from '@/components/theme-provider';
import { parseTiptapContent, serializeTiptapJson } from '@/lib/tiptap-content';

interface TiptapRichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
}

function EditorToolbar() {
  return (
    <MenuControlsContainer>
      <MenuButtonBold />
      <MenuButtonItalic />
      <MenuButtonUnderline />
      <MenuButtonStrikethrough />
      <MenuButtonBulletedList />
      <MenuButtonOrderedList />
      <MenuButtonCodeBlock />
      <MenuButtonRemoveFormatting />
    </MenuControlsContainer>
  );
}

/**
 * Manual-finding rich text field.
 * Uses mui-tiptap's `useEditor` + the same field surface as `RichTextEditor`
 * (`RichTextEditorProvider` / `RichTextField`) so each tab can persist `editor.getJSON()`.
 */
export function TiptapRichTextEditor({
  value,
  onChange,
  placeholder = 'Detalles de la vulnerabilidad encontrada, comportamiento observado...',
  minHeight = '120px',
}: TiptapRichTextEditorProps) {
  const { theme } = useTheme();
  const onChangeRef = useRef(onChange);
  const lastEmittedRef = useRef(value);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const muiTheme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: theme === 'dark' ? 'dark' : 'light',
          primary: { main: '#7c3aed' },
        },
        typography: {
          fontFamily: 'var(--font-roboto), ui-sans-serif, system-ui, sans-serif',
          fontSize: 12,
        },
        shape: { borderRadius: 12 },
        components: {
          MuiIconButton: {
            styleOverrides: {
              root: { padding: 4 },
            },
          },
        },
      }),
    [theme]
  );

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        horizontalRule: false,
        link: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    [placeholder]
  );

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions,
    content: parseTiptapContent(value),
    onUpdate: ({ editor: instance }) => {
      const next = serializeTiptapJson(instance.getJSON(), instance.isEmpty);
      lastEmittedRef.current = next;
      onChangeRef.current(next);
    },
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (value === lastEmittedRef.current) return;
    lastEmittedRef.current = value;
    editor.commands.setContent(parseTiptapContent(value), { emitUpdate: false });
  }, [editor, value]);

  return (
    <MuiThemeProvider theme={muiTheme}>
      <RichTextEditorProvider editor={editor}>
        <RichTextField
          variant="outlined"
          className="w-full"
          MenuBarProps={{ disableSticky: true }}
          controls={<EditorToolbar />}
          sx={{
            '& .MuiTiptap-FieldContainer-notchedOutline': {
              borderRadius: '0.75rem',
            },
            '& .MuiTiptap-MenuBar-root': {
              minHeight: 36,
              padding: '2px 6px',
              borderBottom: '1px solid',
              borderColor: 'divider',
            },
            '& .ProseMirror': {
              minHeight,
              maxHeight: 200,
              overflowY: 'auto',
              fontSize: '0.75rem',
              lineHeight: 1.5,
              padding: '8px 12px',
            },
            '& .ProseMirror p.is-editor-empty:first-child::before, & .ProseMirror p.is-empty:first-child::before': {
              color: 'text.disabled',
              fontStyle: 'normal',
            },
            '& .ProseMirror pre': {
              fontFamily: 'var(--font-roboto-mono), ui-monospace, monospace',
              fontSize: '0.7rem',
              borderRadius: 8,
              padding: '8px 10px',
              overflowX: 'auto',
            },
          }}
        />
      </RichTextEditorProvider>
    </MuiThemeProvider>
  );
}

TiptapRichTextEditor.displayName = RichTextEditor.displayName ?? 'TiptapRichTextEditor';
