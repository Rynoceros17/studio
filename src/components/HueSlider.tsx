
"use client";

import React, { useState, useEffect } from 'react';
import useLocalStorage from '@/hooks/useLocalStorage';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Palette } from 'lucide-react';
import { Label } from './ui/label';

export function HueSlider() {
  const [hue, setHue] = useLocalStorage('app-primary-hue', 259);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    document.documentElement.style.setProperty('--primary-hue', String(hue));
  }, [hue]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 w-9 md:h-10 md:w-10 text-primary hover:bg-primary/10"
          aria-label="Change theme color"
        >
          <Palette className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-4" align="start">
        <div className="space-y-4">
          <Label htmlFor="hue-slider" className="text-sm font-medium text-center block">
            Theme Hue ({hue}°)
          </Label>
          <Slider
            id="hue-slider"
            min={0}
            max={360}
            step={1}
            value={[hue]}
            onValueChange={(value) => setHue(value[0])}
            className="w-full"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
