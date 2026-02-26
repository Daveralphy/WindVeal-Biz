import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import type { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Start typing...'
      }),
    ],
    content: value,
    onUpdate: ({ editor: current }: { editor: Editor }) => {
      const html = current.getHTML();
      onChange(current.isEmpty ? '' : html);
    },
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const html = editor.getHTML();
    if (value !== html) {
      editor.commands.setContent(value, false);
    }
  }, [editor, value]);

  if (!editor) return null;

  const baseButton =
    'px-2 py-1 text-[11px] rounded border border-transparent text-vb-text-secondary hover:text-vb-text hover:bg-vb-card';
  const activeButton = 'border-vb-border bg-vb-card text-vb-text';

  function buttonClass(active: boolean) {
    return `${baseButton} ${active ? activeButton : ''}`;
  }

  return (
    <div className="rich-editor">
      <div className="rich-editor-toolbar">
        <button
          type="button"
          className={buttonClass(editor.isActive('bold'))}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          B
        </button>
        <button
          type="button"
          className={buttonClass(editor.isActive('italic'))}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          I
        </button>
        <button
          type="button"
          className={buttonClass(editor.isActive('underline'))}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          U
        </button>
        <span className="rich-editor-divider" />
        <button
          type="button"
          className={buttonClass(editor.isActive('bulletList'))}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          • List
        </button>
        <button
          type="button"
          className={buttonClass(editor.isActive('orderedList'))}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1. List
        </button>
        <span className="rich-editor-divider" />
        <button
          type="button"
          className={buttonClass(editor.isActive('blockquote'))}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          Quote
        </button>
        <button
          type="button"
          className={buttonClass(editor.isActive('codeBlock'))}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          Code
        </button>
        <span className="rich-editor-divider" />
        <button
          type="button"
          className={buttonClass(editor.isActive({ textAlign: 'left' }))}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        >
          Left
        </button>
        <button
          type="button"
          className={buttonClass(editor.isActive({ textAlign: 'center' }))}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        >
          Center
        </button>
        <button
          type="button"
          className={buttonClass(editor.isActive({ textAlign: 'right' }))}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
        >
          Right
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
