import Editor from '@monaco-editor/react';

interface CodeEditorProps {
  file: { name: string; content: string; path?: string } | null;
  onChange?: (content: string) => void;
}

export default function CodeEditor({ file, onChange }: CodeEditorProps) {
  if (!file) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        Select a file to view its contents
      </div>
    );
  }

  const language = file.name.endsWith('.tsx') || file.name.endsWith('.ts')
    ? 'typescript'
    : file.name.endsWith('.css')
    ? 'css'
    : file.name.endsWith('.json')
    ? 'json'
    : 'javascript';

  return (
    <Editor
      height="100%"
      theme="vs-dark"
      language={language}
      value={file.content}
      onChange={(value) => onChange && onChange(value ?? '')}
      onMount={(editor, monaco) => {
        // Add Cmd/Ctrl+S to trigger save (call onChange with current value)
        try {
          const key = monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS;
          editor.addCommand(key, () => {
            if (onChange) {
              onChange(editor.getValue());
            }
          });
        } catch {
          // ignore if monaco keybindings not available
        }
      }}
      options={{
        minimap: { enabled: true },
        fontSize: 14,
        wordWrap: 'on',
        scrollBeyondLastLine: false,
      }}
    />
  );
}