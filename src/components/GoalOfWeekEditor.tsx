
"use client";

import React, { useMemo, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import BulletList from '@tiptap/extension-bullet-list';
import ListItem from '@tiptap/extension-list-item';
import { Bold, Italic, List, AlignCenter, AlignLeft, AlignRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { format, startOfWeek } from 'date-fns';

const MenuBar = ({ editor }: { editor: any | null }) => {
  if (!editor) {
    return null;
  }

  const menuItems = [
    {
      icon: Bold,
      onClick: () => editor.chain().focus().toggleBold().run(),
      isActive: editor.isActive('bold'),
      label: 'Bold',
    },
    {
      icon: Italic,
      onClick: () => editor.chain().focus().toggleItalic().run(),
      isActive: editor.isActive('italic'),
      label: 'Italic',
    },
    {
      icon: List,
      onClick: () => editor.chain().focus().toggleBulletList().run(),
      isActive: editor.isActive('bulletList'),
      label: 'Bullet List',
    },
    {
      icon: AlignLeft,
      onClick: () => editor.chain().focus().setTextAlign('left').run(),
      isActive: editor.isActive({ textAlign: 'left' }),
      label: 'Align Left',
    },
    {
      icon: AlignCenter,
      onClick: () => editor.chain().focus().setTextAlign('center').run(),
      isActive: editor.isActive({ textAlign: 'center' }),
      label: 'Align Center',
    },
    {
      icon: AlignRight,
      onClick: () => editor.chain().focus().setTextAlign('right').run(),
      isActive: editor.isActive({ textAlign: 'right' }),
      label: 'Align Right',
    },
  ];

  return (
    <div className="flex items-center space-x-1 border-b p-2 bg-muted/50">
      {menuItems.map((item, index) => (
        <Button
          key={index}
          onClick={item.onClick}
          variant="ghost"
          size="icon"
          className={cn(
            'h-8 w-8',
            item.isActive ? 'bg-primary/20 text-primary' : 'text-muted-foreground'
          )}
          aria-label={item.label}
        >
          <item.icon className="h-4 w-4" />
        </Button>
      ))}
    </div>
  );
};

export function GoalOfWeekEditor({
    currentDisplayDate,
    goalsByWeek,
    setGoalsByWeek
}: {
    currentDisplayDate: Date;
    goalsByWeek: Record<string, string>;
    setGoalsByWeek: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  const currentWeekKey = useMemo(() => {
    const weekStart = startOfWeek(currentDisplayDate, { weekStartsOn: 1 });
    return format(weekStart, 'yyyy-MM-dd');
  }, [currentDisplayDate]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      BulletList,
      ListItem,
    ],
    content: goalsByWeek[currentWeekKey] || '<p>Set your intention for the week!</p>',
    onUpdate: ({ editor }) => {
      setGoalsByWeek(prev => ({
          ...prev,
          [currentWeekKey]: editor.getHTML(),
      }));
    },
    editorProps: {
      attributes: {
        class:
          'w-full min-h-[120px] max-h-[300px] rounded-b-md bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 overflow-auto',
      },
    },
  });

  useEffect(() => {
      if (editor && editor.isAttached) {
          const content = goalsByWeek[currentWeekKey] || '<p>Set your intention for the week!</p>';
          // Check if the editor's current content is different from the new content
          // This prevents resetting the cursor position during typing
          if (editor.getHTML() !== content) {
              editor.commands.setContent(content, false); // `false` prevents firing the onUpdate callback again
          }
      }
  }, [currentWeekKey, goalsByWeek, editor]);

  return (
    <Card className="shadow-sm">
      <CardHeader className='pb-2'>
        <CardTitle className="text-lg font-semibold text-primary">Goal of the Week</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-input">
          <MenuBar editor={editor} />
          <EditorContent editor={editor} />
        </div>
      </CardContent>
    </Card>
  );
}
