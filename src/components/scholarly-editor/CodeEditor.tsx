"use client";

import Editor from "@monaco-editor/react";
import { useEffect, useState } from "react";

interface CodeEditorProps {
  code: string;
  onChange?: (value: string | undefined) => void;
  onCompile?: () => void;
  readOnly?: boolean;
}

export default function CodeEditor({ code, onChange, onCompile, readOnly = false }: CodeEditorProps) {
  const [theme, setTheme] = useState('vs-dark');
  const isDark = typeof window !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';

  const handleEditorDidMount = (editor: any, monaco: any) => {
    if (onCompile) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        onCompile();
      });
    }
  };

  useEffect(() => {
    setTheme(isDark ? 'vs-dark' : 'vs');
  }, [isDark]);

  return (
    <div style={{ height: '100%', width: '100%', borderRight: '1px solid var(--border)' }}>
      <Editor
        height="100%"
        defaultLanguage="latex"
        theme={theme}
        value={code}
        onChange={onChange}
        onMount={handleEditorDidMount}
        options={{
          readOnly: readOnly,
          minimap: { enabled: false },
          fontSize: 14,
          wordWrap: "on",
          lineNumbers: "on",
          lineNumbersMinChars: 3,
          glyphMargin: false,
          lineDecorationsWidth: 0,
          fontLigatures: true,
          padding: { top: 16 },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: "smooth",
          formatOnPaste: true,
        }}
        loading={<div style={{ padding: '2rem', color: 'var(--text-secondary)' }}>Loading LaTeX Editor...</div>}
      />
    </div>
  );
}
