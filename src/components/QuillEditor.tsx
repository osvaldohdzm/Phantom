/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';

interface QuillInstance {
  root: {
    innerHTML: string;
  };
  on: (event: string, callback: () => void) => void;
}

interface QuillConstructor {
  new (container: string | Element, options?: { theme?: string; modules?: Record<string, unknown>; placeholder?: string }): QuillInstance;
}

interface CustomWindow extends Window {
  Quill?: QuillConstructor;
}

interface QuillEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  height?: string; // Customizable height
}

export function QuillEditor({ value, onChange, placeholder, height = '110px' }: QuillEditorProps) {
  const [quillLoaded, setQuillLoaded] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const quillInstanceRef = useRef<QuillInstance | null>(null);
  const isUpdatingRef = useRef(false);

  // Keep references to onChange to avoid dependency changes re-initializing the editor
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Keep reference to initial value to avoid dependency changes re-initializing the editor
  const initialValueRef = useRef(value);

  // Load Quill dynamically from CDN to be 100% SSR safe and React 19 compatible
  useEffect(() => {
    const customWindow = window as unknown as CustomWindow;
    if (customWindow.Quill) {
      // Avoid calling setState synchronously during render/effect initialization
      const timer = setTimeout(() => {
        setQuillLoaded(true);
      }, 0);
      return () => clearTimeout(timer);
    }

    // Add Stylesheet
    const cssId = 'quill-cdn-css';
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link');
      link.id = cssId;
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.snow.css';
      document.head.appendChild(link);
    }

    // Add Script
    const scriptId = 'quill-cdn-js';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.js';
      script.async = true;
      script.onload = () => {
        setQuillLoaded(true);
      };
      document.body.appendChild(script);
    } else {
      // Script is already there, check periodically
      const checkInterval = setInterval(() => {
        if (customWindow.Quill) {
          setQuillLoaded(true);
          clearInterval(checkInterval);
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }
  }, []);

  // Initialize Quill editor instance once loaded
  useEffect(() => {
    if (!quillLoaded || !editorRef.current || quillInstanceRef.current) return;

    const customWindow = window as unknown as CustomWindow;
    const Quill = customWindow.Quill;
    if (!Quill) return;

    quillInstanceRef.current = new Quill(editorRef.current, {
      theme: 'snow',
      modules: {
        // Shared clean & minimal compact toolbar configuration
        toolbar: [
          ['bold', 'italic', 'underline', 'strike'],
          [{ 'list': 'ordered' }, { 'list': 'bullet' }],
          ['code-block', 'clean']
        ]
      },
      placeholder: placeholder || 'Detalla la información aquí...'
    });

    // Set initial content using the ref value to avoid dependencies re-evaluation
    if (initialValueRef.current) {
      quillInstanceRef.current.root.innerHTML = initialValueRef.current;
    }

    // Register changes
    quillInstanceRef.current.on('text-change', () => {
      if (isUpdatingRef.current || !quillInstanceRef.current) return;
      const html = quillInstanceRef.current.root.innerHTML;
      // If it's just empty paragraphs, treat it as empty string
      if (html === '<p><br></p>') {
        onChangeRef.current('');
      } else {
        onChangeRef.current(html);
      }
    });

    // Cleanup on unmount
    return () => {
      if (quillInstanceRef.current) {
        quillInstanceRef.current = null;
      }
    };
  }, [quillLoaded, placeholder]);

  // Sync value updates from parent if changed externally
  useEffect(() => {
    if (!quillInstanceRef.current) return;
    const currentHtml = quillInstanceRef.current.root.innerHTML;
    if (value !== currentHtml && value !== '<p><br></p>') {
      isUpdatingRef.current = true;
      quillInstanceRef.current.root.innerHTML = value || '';
      isUpdatingRef.current = false;
    }
  }, [value]);

  return (
    <div className="quill-editor-wrapper w-full">
      <style jsx global>{`
        /* Custom overrides to match the minimal corporate dark/light look */
        .quill-editor-wrapper .ql-toolbar.ql-snow {
          border-color: var(--border, #3f3f46) !important;
          background-color: var(--card, #18181b) !important;
          border-top-left-radius: 0.75rem;
          border-top-right-radius: 0.75rem;
          padding: 6px 10px;
        }
        .quill-editor-wrapper .ql-container.ql-snow {
          border-color: var(--border, #3f3f46) !important;
          background-color: var(--background, #09090b) !important;
          color: var(--foreground, #fafafa) !important;
          border-bottom-left-radius: 0.75rem;
          border-bottom-right-radius: 0.75rem;
          font-family: ui-sans-serif, system-ui, sans-serif;
          font-size: 0.75rem;
        }
        .quill-editor-wrapper .ql-editor {
          min-height: ${height};
          max-height: 200px;
          overflow-y: auto;
          line-height: 1.5;
          padding: 8px 12px;
        }
        .quill-editor-wrapper .ql-editor.ql-blank::before {
          color: var(--muted-foreground, #71717a) !important;
          font-style: normal;
          left: 12px;
          top: 8px;
        }
        .quill-editor-wrapper .ql-snow .ql-stroke {
          stroke: var(--muted-foreground, #71717a) !important;
        }
        .quill-editor-wrapper .ql-snow .ql-fill {
          fill: var(--muted-foreground, #71717a) !important;
        }
        .quill-editor-wrapper .ql-snow .ql-picker {
          color: var(--muted-foreground, #71717a) !important;
        }
        .quill-editor-wrapper .ql-snow .ql-picker-options {
          background-color: var(--card, #18181b) !important;
          border-color: var(--border, #3f3f46) !important;
        }
      `}</style>
      <div ref={editorRef} className="w-full bg-background text-foreground" />
    </div>
  );
}
