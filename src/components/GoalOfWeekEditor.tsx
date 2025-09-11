
"use client";

import React, { useMemo, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { Bold, Italic, List, AlignCenter, AlignLeft, AlignRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import BulletList from '@tiptap/extension-bullet-list';
import ListItem from '@tiptap/extension-list-item';

const MenuBar = ({ editor }: { editor: any | null }) => {
  if (!editor) return null;

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
          className={cn('h-8 w-8', item.isActive ? 'bg-primary/20 text-primary' : 'text-muted-foreground')}
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
  setGoalsByWeek,
}: {
  currentDisplayDate: Date;
  goalsByWeek: Record<string, string>;
  setGoalsByWeek: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  const currentWeekKey = useMemo(() => {
    const weekStart = startOfWeek(currentDisplayDate, { weekStartsOn: 1 });
    return format(weekStart, 'yyyy-MM-dd');
  }, [currentDisplayDate]);

  const weekDateRange = useMemo(() => {
    const weekStart = startOfWeek(currentDisplayDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDisplayDate, { weekStartsOn: 1 });
    return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'd')}`;
  }, [currentDisplayDate]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: false,
        listItem: false,
      }),
      BulletList.configure({
          HTMLAttributes: {
              class: 'list-disc pl-5',
          },
      }),
      ListItem,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: goalsByWeek[currentWeekKey] || '<p>Set your intention for the week!</p>',
    editorProps: {
      attributes: {
        class:
          'tiptap w-full min-h-[120px] max-h-[300px] rounded-b-md bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 overflow-auto',
      },
    },
    onUpdate: ({ editor: e }) => {
      // This onUpdate function will be rebound by the useEffect below
      // to ensure it always saves to the correct week key.
    },
  });

  // Rebind the onUpdate event handler whenever the week key changes.
  // This ensures that edits are saved to the currently viewed week's key.
  useEffect(() => {
    if (!editor) return;
    editor.setOptions({
      onUpdate: ({ editor: e }) => {
        setGoalsByWeek(prev => ({
          ...prev,
          [currentWeekKey]: e.getHTML(),
        }));
      },
    });
  }, [editor, currentWeekKey, setGoalsByWeek]);

  // When the week key changes, check if the editor's content matches
  // the content for the new week. If not, update the editor's content.
  useEffect(() => {
    if (!editor) return;
    const newContent = goalsByWeek[currentWeekKey] || '<p>Set your intention for the week!</p>';
    const currentContent = editor.getHTML();
    if (currentContent !== newContent) {
      editor.commands.setContent(newContent, false); // `false` prevents the onUpdate from firing for this programmatic change.
      editor.commands.focus('end'); // Optional: move cursor to the end.
    }
  }, [editor, currentWeekKey, goalsByWeek]);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-primary">Goal of the Week</CardTitle>
        <CardDescription className="text-sm font-medium">{weekDateRange}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-input">
          <MenuBar editor={editor} />
          <EditorContent key={currentWeekKey} editor={editor} />
        </div>
      </CardContent>
    </Card>
  );
}
