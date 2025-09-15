
"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Check } from 'lucide-react';

const presetThemes = [
  { name: 'Amethyst', hue: 259 },
  { name: 'Sapphire', hue: 220 },
  { name: 'Jade', hue: 140 },
  { name: 'Beehive', hue: 25 },
  { name: 'Crimson', hue: 0 },
];

interface ThemePresetsProps {
  setHue: (hue: number) => void;
  currentHue?: number;
}

export function ThemePresets({ setHue, currentHue }: ThemePresetsProps) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {presetThemes.map((theme) => (
        <Button
          key={theme.name}
          variant="outline"
          className="h-12 w-full p-0 rounded-md flex items-center justify-center"
          onClick={() => setHue(theme.hue)}
          style={{ backgroundColor: `hsl(${theme.hue}, 43%, 61%)` }}
          aria-label={`Set theme to ${theme.name}`}
        >
          {currentHue === theme.hue && <Check className="h-5 w-5 text-white" />}
        </Button>
      ))}
    </div>
  );
}
