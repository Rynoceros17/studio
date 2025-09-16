
"use client";

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Calendar, Target, BrainCircuit } from 'lucide-react';
import { cn } from '@/lib/utils';
import useLocalStorage from '@/hooks/use-local-storage';
import { HueSlider } from './HueSlider';
import { Label } from './ui/label';

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
    <div className="flex items-start space-x-4">
        <div className="flex-shrink-0 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            {icon}
        </div>
        <div>
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
    </div>
);

export function LandingPage() {
  const [hue, setHue] = useLocalStorage('app-primary-hue', 259);

  return (
    <div 
        className="min-h-screen w-full bg-background flex flex-col overflow-hidden"
        style={{
            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80' width='80' height='80'%3e%3cpath fill='%239ca3af' fill-opacity='0.05' d='M14 16.1V13.9L18.2 11.5L22.5 13.9V16.1L18.2 18.5L14 16.1Z M25.5 16.1V13.9L29.8 11.5L34 13.9V16.1L29.8 18.5L25.5 16.1Z M37 16.1V13.9L41.2 11.5L45.5 13.9V16.1L41.2 18.5L37 16.1Z M48.5 16.1V13.9L52.8 11.5L57 13.9V16.1L52.8 18.5L48.5 16.1Z M60 16.1V13.9L64.2 11.5L68.5 13.9V16.1L64.2 18.5L60 16.1Z M14 26.6V24.4L18.2 22L22.5 24.4V26.6L18.2 29L14 26.6Z M25.5 26.6V24.4L29.8 22L34 24.4V26.6L29.8 29L25.5 26.6Z M37 26.6V24.4L41.2 22L45.5 24.4V26.6L41.2 29L37 26.6Z M48.5 26.6V24.4L52.8 22L57 24.4V26.6L52.8 29L48.5 26.6Z M60 26.6V24.4L64.2 22L68.5 24.4V26.6L64.2 29L60 26.6Z M14 37.1V34.9L18.2 32.5L22.5 34.9V37.1L18.2 39.5L14 37.1Z M25.5 37.1V34.9L29.8 32.5L34 34.9V37.1L29.8 39.5L25.5 37.1Z M37 37.1V34.9L41.2 32.5L45.5 34.9V37.1L41.2 39.5L37 37.1Z M48.5 37.1V34.9L52.8 32.5L57 34.9V37.1L52.8 39.5L48.5 37.1Z M60 37.1V34.9L64.2 32.5L68.5 34.9V37.1L64.2 39.5L60 37.1Z M14 47.6V45.4L18.2 43L22.5 45.4V47.6L18.2 50L14 47.6Z M25.5 47.6V45.4L29.8 43L34 45.4V47.6L29.8 50L25.5 47.6Z M37 47.6V45.4L41.2 43L45.5 45.4V47.6L41.2 50L37 47.6Z M48.5 47.6V45.4L52.8 43L57 45.4V47.6L52.8 50L48.5 47.6Z M60 47.6V45.4L64.2 43L68.5 45.4V47.6L64.2 50L60 47.6Z M14 58.1V55.9L18.2 53.5L22.5 55.9V58.1L18.2 60.5L14 58.1Z M25.5 58.1V55.9L29.8 53.5L34 55.9V58.1L29.8 60.5L25.5 58.1Z M37 58.1V55.9L41.2 53.5L45.5 55.9V58.1L41.2 60.5L37 58.1Z M48.5 58.1V55.9L52.8 53.5L57 55.9V58.1L52.8 60.5L48.5 58.1Z M60 58.1V55.9L64.2 53.5L68.5 55.9V58.1L64.2 60.5L60 58.1Z M14 68.6V66.4L18.2 64L22.5 66.4V68.6L18.2 71L14 68.6Z M25.5 68.6V66.4L29.8 64L34 66.4V68.6L29.8 71L25.5 68.6Z M37 68.6V66.4L41.2 64L45.5 66.4V68.6L41.2 71L37 68.6Z M48.5 68.6V66.4L52.8 64L57 66.4V68.6L52.8 71L48.5 68.6Z M60 68.6V66.4L64.2 64L68.5 66.4V68.6L64.2 71L60 68.6Z'%3e%3c/path%3e%3c/svg%3e")`
        }}
    >
      <div className="flex-grow flex items-center justify-center p-4">
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          
          <motion.div
            className="space-y-6 text-center md:text-left"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            whileHover={{ scale: 1.02 }}
          >
            <h1 className={cn(
              "text-4xl md:text-5xl font-bold tracking-tighter text-primary",
              "animate-shine bg-[length:200%_100%] bg-clip-text text-transparent",
              "bg-gradient-to-r from-primary via-primary/50 to-primary"
            )}>
              Welcome to WeekWise.
            </h1>
            <p className="text-lg text-muted-foreground">
              Your intelligent educational planner. Organize your schedule, track your goals, and master your studies with the power of AI.
            </p>
            <div className="flex flex-col gap-4 justify-center md:justify-start max-w-xs mx-auto md:mx-0">
              <Link href="/signup" passHref legacyBehavior>
                <Button size="lg" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">Sign Up</Button>
              </Link>
              <Link href="/login" passHref legacyBehavior>
                <Button size="lg" variant="outline" className="w-full border-foreground/80 text-foreground hover:bg-foreground/5 hover:text-foreground">Login</Button>
              </Link>
            </div>
            <p className="text-xs text-muted-foreground pt-2">
              Sign up for a free account to get started.
            </p>
             <div className="pt-6 max-w-xs mx-auto md:mx-0">
                <Label className="text-sm font-medium text-muted-foreground">Customize:</Label>
                <div className="mt-2">
                    <HueSlider hue={hue} setHue={setHue} />
                </div>
            </div>
          </motion.div>

          
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            whileHover={{ scale: 1.03, y: -5, boxShadow: "0px 10px 30px -5px rgba(0,0,0,0.1)" }}
          >
            <Card className="bg-secondary/30 border-none shadow-xl">
                <CardContent className="p-8 space-y-6">
                   <FeatureCard 
                      icon={<BrainCircuit className="h-6 w-6 text-primary" />} 
                      title="AI-Powered Scheduling" 
                      description="Add tasks and events using natural language. Let our AI handle the details."
                   />
                   <FeatureCard 
                      icon={<Calendar className="h-6 w-6 text-primary" />} 
                      title="Dynamic Calendar" 
                      description="View your week at a glance or dive into a detailed daily schedule."
                    />
                   <FeatureCard 
                      icon={<Target className="h-6 w-6 text-primary" />} 
                      title="Goal Tracking" 
                      description="Set academic goals, break them down into sub-tasks, and track your progress."
                    />
                </CardContent>
            </Card>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
