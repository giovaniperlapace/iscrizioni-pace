"use client";

import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  RemoveFormatting,
  UnderlineIcon,
} from "lucide-react";
import { useEffect } from "react";

type CampaignRichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  tokenToInsert: string | null;
  onTokenInserted: () => void;
};

export function CampaignRichTextEditor({
  value,
  onChange,
  tokenToInsert,
  onTokenInserted,
}: CampaignRichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class:
          "min-h-64 px-4 py-3 text-sm leading-6 outline-none [&_h2]:my-3 [&_h2]:text-xl [&_h2]:font-bold [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6",
      },
    },
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => onChange(currentEditor.getHTML()),
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "<p></p>");
    }
  }, [editor, value]);

  useEffect(() => {
    if (!editor || !tokenToInsert) return;
    editor.chain().focus().insertContent(tokenToInsert).run();
    onTokenInserted();
  }, [editor, onTokenInserted, tokenToInsert]);

  function addLink() {
    if (!editor) return;
    const currentHref = editor.getAttributes("link").href as string | undefined;
    const href = window.prompt("Indirizzo del link", currentHref ?? "https://");
    if (href === null) return;
    if (!href.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run();
  }

  const controls = [
    { label: "Grassetto", Icon: Bold, action: () => editor?.chain().focus().toggleBold().run() },
    { label: "Corsivo", Icon: Italic, action: () => editor?.chain().focus().toggleItalic().run() },
    { label: "Sottolineato", Icon: UnderlineIcon, action: () => editor?.chain().focus().toggleUnderline().run() },
    { label: "Titolo", Icon: Heading2, action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: "Elenco puntato", Icon: List, action: () => editor?.chain().focus().toggleBulletList().run() },
    { label: "Elenco numerato", Icon: ListOrdered, action: () => editor?.chain().focus().toggleOrderedList().run() },
    { label: "Link", Icon: Link2, action: addLink },
    { label: "Rimuovi formattazione", Icon: RemoveFormatting, action: () => editor?.chain().focus().clearNodes().unsetAllMarks().run() },
  ] as const;

  return (
    <div className="overflow-hidden rounded-md border border-[var(--peace-border-strong)] bg-white focus-within:shadow-[var(--focus-ring)]">
      <div className="flex flex-wrap gap-1 border-b border-[var(--peace-border)] bg-[#f7fbfe] p-2">
        {controls.map(({ label, Icon, action }) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            title={label}
            className="grid min-h-9 min-w-9 place-items-center rounded border border-transparent text-[var(--peace-ink)] hover:border-[var(--peace-border)] hover:bg-white"
            onClick={action}
          >
            <Icon aria-hidden="true" className="h-4 w-4" />
          </button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
