
"use client";

import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Label } from './ui/label';

interface HueSliderProps {
  hue: number;
  setHue: (hue: number) => void;
}

export function HueSlider({ hue, setHue }: HueSliderProps) {
  React.useEffect(() => {
    document.documentElement.style.setProperty('--primary-hue', String(hue));
  }, [hue]);

  return (
    <div className="space-y-3">
      <Label htmlFor="hue-slider" className="text-sm font-medium">
        Custom Hue ({hue}°)
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
  );
}
