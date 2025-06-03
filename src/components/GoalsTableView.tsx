
"use client";

import React, { useRef, useLayoutEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, PlusCircle, CornerDownRight, X } from 'lucide-react'; // Removed ChevronDown, ChevronRight
import type { Goal, Subtask } from '@/lib/types';
import { cn, truncateText, calculateGoalProgress } from '@/lib/utils';
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from 'date-fns';

interface GoalsTableViewProps {
  goals: Goal[];
  // expandedSubtasks: Record<string, boolean>; // Kept in props for interface consistency, but will be ignored
  // toggleSubtaskExpansion: (itemId: string) => void; // Kept in props for interface consistency, but will be ignored
  newSubtaskInputs: Record<string, string>;
  handleSubtaskInputChange: (parentId: string, value: string) => void;
  handleKeyPressSubtask: (event: React.KeyboardEvent<HTMLInputElement>, goalId: string, parentItemId?: string) => void;
  addSubtaskToGoalOrSubtask: (goalId: string, parentItemId?: string) => void;
  toggleSubtaskCompletion: (goalId: string, subtaskIdToToggle: string) => void;
  showAddChildInputFor: string | null;
  setShowAddChildInputFor: (id: string | null) => void;
  handleCreateTaskFromSubtask: (subtask: Subtask) => void;
  deleteSubtaskFromGoal: (goalId: string, subtaskIdToDelete: string) => void;
  deleteGoal: (goalId: string) => void;
}

// Component for the deepest level tasks (Grandchildren)
const GrandchildTaskItem: React.FC<{
  task: Subtask;
  goalId: string;
  parentSubtaskId: string;
  props: GoalsTableViewProps;
  depth: number;
}> = ({ task, goalId, parentSubtaskId, props, depth }) => {
  const {
    toggleSubtaskCompletion, handleCreateTaskFromSubtask, deleteSubtaskFromGoal,
    showAddChildInputFor, setShowAddChildInputFor, newSubtaskInputs, handleSubtaskInputChange,
    handleKeyPressSubtask, addSubtaskToGoalOrSubtask
  } = props;

  const hasChildren = task.subtasks && task.subtasks.length > 0;

  return (
    <div className={cn("border-b border-border/30 flex flex-col py-1", task.completed && "opacity-70 bg-muted/30")}>
      <div className="flex items-center">
        <div className="flex items-center space-x-1.5 min-w-0 flex-grow pl-2">
          {/* Always render children if they exist, remove chevron */}
          <span className="w-6 inline-block shrink-0">
            {/* Placeholder for potential future icons if needed, or just spacing */}
          </span>
          <Checkbox
            id={`gc-${task.id}`}
            checked={task.completed}
            onCheckedChange={() => toggleSubtaskCompletion(goalId, task.id)}
            className="shrink-0 h-4 w-4 border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
          />
          <Label htmlFor={`gc-${task.id}`} className={cn("text-xs truncate", task.completed && "line-through text-muted-foreground")} title={task.name}>
            {truncateText(task.name, 30)}
          </Label>
        </div>
        <div className="flex items-center space-x-1 shrink-0 pr-2">
          <Button variant="outline" size="icon" className={cn("h-6 w-6 border-dashed text-xs", task.completed && "cursor-not-allowed")} onClick={() => !task.completed && setShowAddChildInputFor(task.id)} disabled={task.completed} title="Add Child">
            <Plus className="h-3 w-3" />
          </Button>
          <Button variant="outline" size="icon" className={cn("h-6 w-6 text-xs", task.completed && "cursor-not-allowed")} onClick={() => !task.completed && handleCreateTaskFromSubtask(task)} disabled={task.completed} title="Create Calendar Task">
            <PlusCircle className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10 text-xs" onClick={() => deleteSubtaskFromGoal(goalId, task.id)} title="Delete Task">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
       {showAddChildInputFor === task.id && (
        <div className="w-full pl-8 pr-2 py-1 bg-background border-t border-border/50 mt-1">
          <div className="flex space-x-2 items-center">
            <Input
              value={newSubtaskInputs[task.id] || ''}
              onChange={(e) => handleSubtaskInputChange(task.id, e.target.value)}
              placeholder="Add a deeper subtask..."
              className="h-7 text-xs flex-grow"
              onKeyPress={(e) => handleKeyPressSubtask(e, goalId, task.id)}
              autoFocus
            />
            <Button onClick={() => addSubtaskToGoalOrSubtask(goalId, task.id)} size="sm" className="h-7 px-2 text-xs shrink-0">
              <CornerDownRight className="mr-1 h-3 w-3" /> Add
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShowAddChildInputFor(null)} className="h-7 w-7 text-xs shrink-0">
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
      {/* Always render children if they exist */}
      {hasChildren && (
        <div className="pl-4 w-full border-t border-border/30 mt-1">
          {task.subtasks?.map(sub => (
            <GrandchildTaskItem key={sub.id} task={sub} goalId={goalId} parentSubtaskId={task.id} props={props} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

// Component for Child Subtasks (Middle Column)
const ChildRow: React.FC<{
  subtask: Subtask;
  goalId: string;
  props: GoalsTableViewProps;
  depth: number;
}> = ({ subtask, goalId, props, depth }) => {
  const {
    newSubtaskInputs, handleSubtaskInputChange,
    handleKeyPressSubtask, addSubtaskToGoalOrSubtask, toggleSubtaskCompletion,
    showAddChildInputFor, setShowAddChildInputFor, handleCreateTaskFromSubtask,
    deleteSubtaskFromGoal
  } = props;

  const childCellRef = useRef<HTMLDivElement>(null);
  const grandchildrenColumnRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (childCellRef.current && grandchildrenColumnRef.current) {
      const grandchildrenHeight = grandchildrenColumnRef.current.scrollHeight;
      // Always expanded, so check if subtasks exist
      childCellRef.current.style.minHeight = subtask.subtasks && subtask.subtasks.length > 0 ? `${grandchildrenHeight}px` : 'auto';
    } else if (childCellRef.current) {
         childCellRef.current.style.minHeight = 'auto';
    }
  }, [subtask.subtasks, subtask.subtasks?.length, newSubtaskInputs, showAddChildInputFor]);


  const hasGrandchildren = subtask.subtasks && subtask.subtasks.length > 0;

  return (
    <div className={cn("flex border-b border-border/50", subtask.completed && "opacity-80 bg-muted/20")}>
      <div ref={childCellRef} className="w-1/2 border-r border-border/50 p-2 flex flex-col justify-between">
        <div className="flex-grow">
          <div className="flex items-center space-x-1.5 min-w-0 mb-1">
            {/* Always render children if they exist, remove chevron */}
            <span className="w-7 inline-block shrink-0">
                {/* Placeholder for potential future icons or just spacing */}
            </span>
            <Checkbox
              id={`child-${subtask.id}`}
              checked={subtask.completed}
              onCheckedChange={() => toggleSubtaskCompletion(goalId, subtask.id)}
              className="shrink-0 h-4 w-4 border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
            />
            <Label htmlFor={`child-${subtask.id}`} className={cn("text-sm font-medium truncate", subtask.completed && "line-through text-muted-foreground")} title={subtask.name}>
              {truncateText(subtask.name, 25)}
            </Label>
          </div>
          {showAddChildInputFor === subtask.id && (
            <div className="mt-1.5 p-1.5 border rounded-md bg-background shadow-sm">
              <div className="flex space-x-2 items-center">
                <Input
                  value={newSubtaskInputs[subtask.id] || ''}
                  onChange={(e) => handleSubtaskInputChange(subtask.id, e.target.value)}
                  placeholder="Add a task..."
                  className="h-8 text-xs flex-grow"
                  onKeyPress={(e) => handleKeyPressSubtask(e, goalId, subtask.id)}
                  autoFocus
                />
                <Button onClick={() => addSubtaskToGoalOrSubtask(goalId, subtask.id)} size="sm" className="h-8 px-2 text-xs shrink-0">
                  <CornerDownRight className="mr-1 h-3 w-3" /> Add
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setShowAddChildInputFor(null)} className="h-8 w-8 text-xs shrink-0">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-1 mt-1 pt-1">
          <Button variant="outline" size="icon" className={cn("h-7 w-7 border-dashed text-xs", subtask.completed && "cursor-not-allowed")} onClick={() => !subtask.completed && setShowAddChildInputFor(subtask.id)} disabled={subtask.completed} title="Add Task">
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className={cn("h-7 w-7 text-xs", subtask.completed && "cursor-not-allowed")} onClick={() => !task.completed && handleCreateTaskFromSubtask(subtask)} disabled={subtask.completed} title="Create Calendar Task">
            <PlusCircle className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 text-xs" onClick={() => deleteSubtaskFromGoal(goalId, subtask.id)} title="Delete Sub-Goal">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div ref={grandchildrenColumnRef} className="w-1/2 flex flex-col">
        {/* Always render children if they exist */}
        {hasGrandchildren ? (
          subtask.subtasks?.map(gc => (
            <GrandchildTaskItem key={gc.id} task={gc} goalId={goalId} parentSubtaskId={subtask.id} props={props} depth={depth + 1} />
          ))
        ) : (
             <div className="p-2 text-center text-xs text-muted-foreground italic flex-grow flex items-center justify-center">No further tasks.</div>
        )}
      </div>
    </div>
  );
};

// Component for Top-Level Goals (First Column)
const GoalRow: React.FC<{ goal: Goal; props: GoalsTableViewProps }> = ({ goal, props }) => {
  const {
    newSubtaskInputs, handleSubtaskInputChange,
    handleKeyPressSubtask, addSubtaskToGoalOrSubtask, showAddChildInputFor,
    setShowAddChildInputFor, deleteGoal
  } = props;

  const parentCellRef = useRef<HTMLDivElement>(null);
  const childrenColumnRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (parentCellRef.current && childrenColumnRef.current) {
      const childrenHeight = childrenColumnRef.current.scrollHeight;
      // Always expanded, so check if subtasks exist
      parentCellRef.current.style.minHeight = goal.subtasks && goal.subtasks.length > 0 ? `${childrenHeight}px` : 'auto';
    } else if (parentCellRef.current) {
        parentCellRef.current.style.minHeight = 'auto';
    }
  }, [goal.subtasks, goal.subtasks?.length, newSubtaskInputs, showAddChildInputFor]);

  const progress = calculateGoalProgress(goal);
  const hasChildren = goal.subtasks && goal.subtasks.length > 0;

  return (
    <div className="flex border-b-2 border-primary/30 bg-secondary/10">
      <div ref={parentCellRef} className="w-1/3 border-r border-primary/30 p-3 flex flex-col justify-between">
        <div className="flex-grow">
          <div className="flex items-center space-x-1.5 min-w-0 mb-1.5">
            {/* Always render children if they exist, remove chevron */}
            <span className="w-8 inline-block shrink-0">
                 {/* Placeholder for potential future icons or just spacing */}
            </span>
            <h3 className="text-base font-semibold text-primary truncate" title={goal.name}>
              {truncateText(goal.name, 30)}
            </h3>
          </div>
          <div className="pl-10 space-y-1 text-xs text-muted-foreground">
            <div className="flex items-center">
              Progress: <Badge variant={progress === 100 ? "default" : "secondary"} className="ml-1 text-xs">{progress}%</Badge>
            </div>
            {goal.dueDate && <p>Due: {format(parseISO(goal.dueDate), 'MMM d, yyyy')}</p>}
          </div>
           {showAddChildInputFor === goal.id && (
            <div className="mt-2 p-2 border rounded-md bg-background shadow-sm">
              <div className="flex space-x-2 items-center">
                <Input
                  value={newSubtaskInputs[goal.id] || ''}
                  onChange={(e) => handleSubtaskInputChange(goal.id, e.target.value)}
                  placeholder="Add a sub-goal/task..."
                  className="h-9 text-sm flex-grow"
                  onKeyPress={(e) => handleKeyPressSubtask(e, goal.id, undefined)}
                  autoFocus
                />
                <Button onClick={() => addSubtaskToGoalOrSubtask(goal.id, undefined)} size="sm" className="h-9 px-2.5 text-sm shrink-0">
                  <CornerDownRight className="mr-1 h-3.5 w-3.5" /> Add
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setShowAddChildInputFor(null)} className="h-9 w-9 text-sm shrink-0">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-1 mt-1 pt-2 pl-10">
          <Button variant="outline" size="sm" className="h-8 text-xs border-dashed" onClick={() => setShowAddChildInputFor(goal.id)} title="Add Sub-Goal/Task">
            <Plus className="mr-1 h-3.5 w-3.5" /> Sub-Goal
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => deleteGoal(goal.id)} title="Delete Goal">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div ref={childrenColumnRef} className="w-2/3 flex flex-col min-h-0">
        {/* Always render children if they exist */}
        {hasChildren ? (
          goal.subtasks.map(subtask => (
            <ChildRow key={subtask.id} subtask={subtask} goalId={goal.id} props={props} depth={1}/>
          ))
        ) : (
            <div className="p-4 text-center text-sm text-muted-foreground italic flex-grow flex items-center justify-center">No sub-goals or tasks for this goal.</div>
        )}
      </div>
    </div>
  );
};

export const GoalsTableView: React.FC<GoalsTableViewProps> = (props) => {
  const { goals } = props;

  if (goals.length === 0) {
    return (
         <Card className="shadow-md border">
            <CardContent className="p-0">
                <div className="p-10 text-center text-muted-foreground">
                    No goals yet. Switch to Accordion view to add a new goal using the form at the top.
                </div>
            </CardContent>
         </Card>
    );
  }

  return (
    <Card className="shadow-md border overflow-hidden">
      <CardContent className="p-0">
        {/* Header Row */}
        <div className="flex bg-muted/60 border-b-2 border-primary/40 font-semibold text-sm text-primary sticky top-0 z-10">
          <div className="w-1/3 p-3 border-r border-primary/30">Goal</div>
          <div className="w-2/3 flex">
            <div className="w-1/2 p-3 border-r border-primary/30">Sub-Goal / Task</div>
            <div className="w-1/2 p-3">Further Breakdown / Actions</div>
          </div>
        </div>
        {/* Goal Rows */}
        <div className="flex flex-col">
          {goals.map(goal => (
            <GoalRow key={goal.id} goal={goal} props={props} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

    