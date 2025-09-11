
"use client";

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Calendar, Target, BrainCircuit } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  return (
    <div className="min-h-screen w-full bg-background flex flex-col overflow-hidden">
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
