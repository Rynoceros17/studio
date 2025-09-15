
"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Check } from 'lucide-react';

const presetThemes = [
  { name: 'Amethyst', hue: 259 },
  { name: 'Sapphire', hue: 220 },
  { name: 'Jade', hue: 157 },
  { name: 'Beehive', hue: 25 },
  { name: 'Crimson', hue: 0 },
];

interface ThemePresetsProps {
  setHue: (hue: number) => void;
  currentHue?: number;
}

export function ThemePresets({ setHue, currentHue }: ThemePresetsProps) {
  return (
    <div className="flex flex-col space-y-2">
      {presetThemes.map((theme) => (
        <Button
          key={theme.name}
          variant="outline"
          className={cn(
            "w-full h-10 px-3 justify-between items-center text-sm",
            currentHue === theme.hue ? "ring-2 ring-ring ring-offset-2 ring-offset-background" : ""
          )}
          onClick={() => setHue(theme.hue)}
          aria-label={`Set theme to ${theme.name}`}
          style={{
            backgroundColor: `hsl(${theme.hue}, 90%, 95%)`,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="h-5 w-5 rounded-full border"
              style={{ backgroundColor: `hsl(${theme.hue}, 43%, 61%)` }}
            />
            <span className="font-medium text-foreground">{theme.name}</span>
          </div>
          {currentHue === theme.hue && <Check className="h-5 w-5 text-primary" />}
        </Button>
      ))}
    </div>
  );
}
