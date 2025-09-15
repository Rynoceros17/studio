
"use client";

import React from 'react';
import useLocalStorage from '@/hooks/useLocalStorage';
import { Slider } from '@/components/ui/slider';
import { Label } from './ui/label';

export function HueSlider() {
  const [hue, setHue] = useLocalStorage('app-primary-hue', 259);

  React.useEffect(() => {
    document.documentElement.style.setProperty('--primary-hue', String(hue));
  }, [hue]);

  return (
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
  );
}
