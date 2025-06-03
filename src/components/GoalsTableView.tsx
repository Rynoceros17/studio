"use client";

import React, { useRef, useLayoutEffect, useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, PlusCircle, CornerDownRight, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { Goal, Subtask } from '@/lib/types';
import { cn, truncateText, calculateGoalProgress } from '@/lib/utils';
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from 'date-fns';

interface GoalsTableViewProps {
  goals: Goal[];
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

const GrandchildTaskItem: React.FC<{
  task: Subtask;
  goalId: string;
  parentSubtaskId: string;
  props: GoalsTableViewProps;
  isSmallScreen: boolean;
}> = ({ task, goalId, parentSubtaskId, props, isSmallScreen }) => {
  const {
    toggleSubtaskCompletion, handleCreateTaskFromSubtask, deleteSubtaskFromGoal,
    showAddChildInputFor, setShowAddChildInputFor, newSubtaskInputs, handleSubtaskInputChange,
    handleKeyPressSubtask, addSubtaskToGoalOrSubtask
  } = props;

  const hasChildren = task.subtasks && task.subtasks.length > 0;
  const paddingLeftClass = isSmallScreen ? "pl-6" : "pl-2"; // More indent on small screens if within parent

  return (
    <div className={cn("border-b border-border/30 flex flex-col py-1 text-[10px]", task.completed && "opacity-70 bg-muted/30")}> {/* Reduced font size */}
      <div className="flex items-center">
        <div className={cn("flex items-center space-x-1 min-w-0 flex-grow", paddingLeftClass)}> {/* Adjusted padding */}
          <span className="w-4 inline-block shrink-0"></span> {/* Reduced spacer */}
          <Checkbox
            id={`gc-${task.id}`}
            checked={task.completed}
            onCheckedChange={() => toggleSubtaskCompletion(goalId, task.id)}
            className="shrink-0 h-3 w-3 border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground" // Reduced checkbox size
          />
          <Label htmlFor={`gc-${task.id}`} className={cn("text-[10px] truncate", task.completed && "line-through text-muted-foreground")} title={task.name}> {/* Reduced font size */}
            {truncateText(task.name, isSmallScreen ? 25 : 30)}
          </Label>
        </div>
        <div className="flex items-center space-x-0.5 shrink-0 pr-1"> {/* Reduced spacing and padding */}
          <Button variant="outline" size="icon" className={cn("h-5 w-5 border-dashed text-[9px]", task.completed && "cursor-not-allowed")} onClick={() => !task.completed && setShowAddChildInputFor(task.id)} disabled={task.completed} title="Add Child"> {/* Reduced button size */}
            <Plus className="h-2.5 w-2.5" /> {/* Reduced icon size */}
          </Button>
          <Button variant="outline" size="icon" className={cn("h-5 w-5 text-[9px]", task.completed && "cursor-not-allowed")} onClick={() => !task.completed && handleCreateTaskFromSubtask(task)} disabled={task.completed} title="Create Calendar Task">
            <PlusCircle className="h-2.5 w-2.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:bg-destructive/10 text-[9px]" onClick={() => deleteSubtaskFromGoal(goalId, task.id)} title="Delete Task">
            <Trash2 className="h-2.5 w-2.5" />
          </Button>
        </div>
      </div>
      {showAddChildInputFor === task.id && (
        <div className={cn("w-full py-1 bg-background border-t border-border/50 mt-1", isSmallScreen ? "pl-10 pr-1" : "pl-6 pr-1")}> {/* Adjusted padding */}
          <div className="flex space-x-1 items-center"> {/* Reduced spacing */}
            <Input
              value={newSubtaskInputs[task.id] || ''}
              onChange={(e) => handleSubtaskInputChange(task.id, e.target.value)}
              placeholder="Add deeper subtask..."
              className="h-6 text-[10px] flex-grow" // Reduced height and font size
              onKeyPress={(e) => handleKeyPressSubtask(e, goalId, task.id)}
              autoFocus
            />
            <Button onClick={() => addSubtaskToGoalOrSubtask(goalId, task.id)} size="sm" className="h-6 px-1.5 text-[9px] shrink-0"> {/* Reduced button size */}
              <CornerDownRight className="mr-0.5 h-2.5 w-2.5" /> Add {/* Reduced icon size */}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShowAddChildInputFor(null)} className="h-6 w-6 text-[9px] shrink-0"> {/* Reduced button size */}
              <X className="h-3 w-3" /> {/* Reduced icon size */}
            </Button>
          </div>
        </div>
      )}
      {hasChildren && (
        <div className={cn("w-full border-t border-border/30 mt-1", isSmallScreen ? "pl-4" : "pl-2")}> {/* Adjusted padding */}
          {task.subtasks?.map(sub => (
            <GrandchildTaskItem key={sub.id} task={sub} goalId={goalId} parentSubtaskId={task.id} props={props} isSmallScreen={isSmallScreen} />
          ))}
        </div>
      )}
    </div>
  );
};

const ChildRow: React.FC<{
  subtask: Subtask;
  goalId: string;
  props: GoalsTableViewProps;
  isSmallScreen: boolean;
}> = ({ subtask, goalId, props, isSmallScreen }) => {
  const {
    newSubtaskInputs, handleSubtaskInputChange,
    handleKeyPressSubtask, addSubtaskToGoalOrSubtask, toggleSubtaskCompletion,
    showAddChildInputFor, setShowAddChildInputFor, handleCreateTaskFromSubtask,
    deleteSubtaskFromGoal
  } = props;

  const childCellRef = useRef<HTMLDivElement>(null);
  const grandchildrenColumnRef = useRef<HTMLDivElement>(null); // For large screen's third column
  const stackedGrandchildrenRef = useRef<HTMLDivElement>(null); // For small screen's stacked items

  useLayoutEffect(() => {
    if (isSmallScreen) {
        if (childCellRef.current && stackedGrandchildrenRef.current) {
            const detailsHeight = childCellRef.current.querySelector('.child-details-area')?.scrollHeight || 0;
            const grandchildrenHeight = stackedGrandchildrenRef.current.scrollHeight;
            childCellRef.current.style.minHeight = `${detailsHeight + grandchildrenHeight}px`;
        } else if (childCellRef.current) {
             childCellRef.current.style.minHeight = childCellRef.current.querySelector('.child-details-area')?.scrollHeight + 'px' || 'auto';
        }
    } else {
        if (childCellRef.current && grandchildrenColumnRef.current) {
            const grandchildrenHeight = grandchildrenColumnRef.current.scrollHeight;
             childCellRef.current.style.minHeight = subtask.subtasks && subtask.subtasks.length > 0 ? `${grandchildrenHeight}px` : 'auto';
        } else if (childCellRef.current) {
            childCellRef.current.style.minHeight = 'auto';
        }
    }
  }, [subtask.subtasks, newSubtaskInputs, showAddChildInputFor, isSmallScreen]);


  const hasGrandchildren = subtask.subtasks && subtask.subtasks.length > 0;

  const childContent = (
    <div className="child-details-area flex flex-col justify-between flex-grow">
        <div>
            <div className="flex items-center space-x-1 min-w-0 mb-1"> {/* Reduced spacing */}
                <span className={cn("inline-block shrink-0", isSmallScreen ? "w-5" : "w-6")}></span> {/* Reduced spacer */}
                <Checkbox
                id={`child-${subtask.id}`}
                checked={subtask.completed}
                onCheckedChange={() => toggleSubtaskCompletion(goalId, subtask.id)}
                className="shrink-0 h-3.5 w-3.5 border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground" // Reduced checkbox size
                />
                <Label htmlFor={`child-${subtask.id}`} className={cn("text-xs font-medium truncate", subtask.completed && "line-through text-muted-foreground")} title={subtask.name}> {/* Reduced font size */}
                {truncateText(subtask.name, isSmallScreen ? 20 : 25)}
                </Label>
            </div>
            {showAddChildInputFor === subtask.id && (
                <div className={cn("mt-1 p-1 border rounded-md bg-background shadow-sm", isSmallScreen ? "ml-5 mr-1" : "ml-6 mr-1")}> {/* Adjusted padding & margin */}
                    <div className="flex space-x-1 items-center"> {/* Reduced spacing */}
                        <Input
                        value={newSubtaskInputs[subtask.id] || ''}
                        onChange={(e) => handleSubtaskInputChange(subtask.id, e.target.value)}
                        placeholder="Add a task..."
                        className="h-7 text-[10px] flex-grow" // Reduced height & font
                        onKeyPress={(e) => handleKeyPressSubtask(e, goalId, subtask.id)}
                        autoFocus
                        />
                        <Button onClick={() => addSubtaskToGoalOrSubtask(goalId, subtask.id)} size="sm" className="h-7 px-1.5 text-[9px] shrink-0"> {/* Reduced button size */}
                            <CornerDownRight className="mr-0.5 h-3 w-3" /> Add {/* Reduced icon */}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setShowAddChildInputFor(null)} className="h-7 w-7 text-[9px] shrink-0"> {/* Reduced button size */}
                            <X className="h-3 w-3" /> {/* Reduced icon */}
                        </Button>
                    </div>
                </div>
            )}
        </div>
        <div className={cn("flex items-center space-x-0.5 mt-1 pt-1", isSmallScreen ? "pl-5" : "pl-6")}> {/* Reduced spacing & margin */}
            <Button variant="outline" size="icon" className={cn("h-6 w-6 border-dashed text-[9px]", subtask.completed && "cursor-not-allowed")} onClick={() => !subtask.completed && setShowAddChildInputFor(subtask.id)} disabled={subtask.completed} title="Add Task"> {/* Reduced button size */}
                <Plus className="h-3 w-3" /> {/* Reduced icon */}
            </Button>
            <Button variant="outline" size="icon" className={cn("h-6 w-6 text-[9px]", subtask.completed && "cursor-not-allowed")} onClick={() => !subtask.completed && handleCreateTaskFromSubtask(subtask)} disabled={subtask.completed} title="Create Calendar Task">
                <PlusCircle className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10 text-[9px]" onClick={() => deleteSubtaskFromGoal(goalId, subtask.id)} title="Delete Sub-Goal">
                <Trash2 className="h-3 w-3" />
            </Button>
        </div>
    </div>
  );

  if (isSmallScreen) {
    return (
        <div ref={childCellRef} className={cn("p-1.5 flex flex-col", subtask.completed && "opacity-80 bg-muted/20")}> {/* Reduced padding */}
            {childContent}
            {hasGrandchildren && (
                <div ref={stackedGrandchildrenRef} className="mt-1 pt-1 border-t border-border/30 w-full">
                    {subtask.subtasks?.map(gc => (
                        <GrandchildTaskItem key={gc.id} task={gc} goalId={goalId} parentSubtaskId={subtask.id} props={props} isSmallScreen={isSmallScreen} />
                    ))}
                </div>
            )}
             {!hasGrandchildren && <div className="p-1 text-center text-[10px] text-muted-foreground italic flex-grow flex items-center justify-center">No further tasks.</div>}
        </div>
    );
  }

  // Large screen layout
  return (
    <div className={cn("flex border-b border-border/50", subtask.completed && "opacity-80 bg-muted/20")}>
      <div ref={childCellRef} className="w-1/2 border-r border-border/50 p-1.5 flex flex-col justify-between"> {/* Reduced padding */}
        {childContent}
      </div>
      <div ref={grandchildrenColumnRef} className="w-1/2 flex flex-col">
        {hasGrandchildren ? (
          subtask.subtasks?.map(gc => (
            <GrandchildTaskItem key={gc.id} task={gc} goalId={goalId} parentSubtaskId={subtask.id} props={props} isSmallScreen={isSmallScreen} />
          ))
        ) : (
             <div className="p-1.5 text-center text-[10px] text-muted-foreground italic flex-grow flex items-center justify-center">No further tasks.</div> // Reduced padding
        )}
      </div>
    </div>
  );
};

const GoalRow: React.FC<{ goal: Goal; props: GoalsTableViewProps; isSmallScreen: boolean; }> = ({ goal, props, isSmallScreen }) => {
  const {
    newSubtaskInputs, handleSubtaskInputChange,
    handleKeyPressSubtask, addSubtaskToGoalOrSubtask, showAddChildInputFor,
    setShowAddChildInputFor, deleteGoal
  } = props;

  const [showAllSubGoals, setShowAllSubGoals] = useState(false);
  const parentCellRef = useRef<HTMLDivElement>(null);
  const childrenColumnRef = useRef<HTMLDivElement>(null);

  const subTasksToDisplay = goal.subtasks && goal.subtasks.length > 3 && !showAllSubGoals
    ? goal.subtasks.slice(0, 3)
    : goal.subtasks || [];

  useLayoutEffect(() => {
    if (parentCellRef.current && childrenColumnRef.current) {
      const childrenHeight = childrenColumnRef.current.scrollHeight;
      parentCellRef.current.style.minHeight = subTasksToDisplay.length > 0 ? `${childrenHeight}px` : 'auto';
    } else if (parentCellRef.current) {
        parentCellRef.current.style.minHeight = 'auto';
    }
  }, [subTasksToDisplay, newSubtaskInputs, showAddChildInputFor, showAllSubGoals, isSmallScreen]); // Added isSmallScreen dependency

  const progress = calculateGoalProgress(goal);
  const hasChildren = goal.subtasks && goal.subtasks.length > 0;
  const hasMoreThanThreeChildren = goal.subtasks && goal.subtasks.length > 3;

  return (
    <div className="flex border-b-2 border-primary/30 bg-secondary/10">
      <div ref={parentCellRef} className={cn("border-r border-primary/30 p-2 flex flex-col justify-between", isSmallScreen ? "w-1/2" : "w-1/3")}> {/* Reduced padding */}
        <div className="flex-grow">
          <div className="flex items-center space-x-1 min-w-0 mb-1"> {/* Reduced spacing */}
            <span className="w-6 inline-block shrink-0"></span> {/* Reduced spacer */}
            <h3 className="text-sm font-semibold text-primary truncate" title={goal.name}> {/* Reduced font size */}
              {truncateText(goal.name, isSmallScreen ? 20 : 30)}
            </h3>
          </div>
          <div className={cn("space-y-0.5 text-[10px] text-muted-foreground", isSmallScreen ? "pl-6" : "pl-7")}> {/* Reduced spacing, font, padding */}
            <div className="flex items-center">
              Progress: <Badge variant={progress === 100 ? "default" : "secondary"} className="ml-1 text-[9px] px-1.5 py-0">{progress}%</Badge> {/* Reduced badge size */}
            </div>
            {goal.dueDate && <p>Due: {format(parseISO(goal.dueDate), 'MMM d, yy')}</p>} {/* Shorter date format */}
          </div>
           {showAddChildInputFor === goal.id && (
            <div className="mt-1.5 p-1.5 border rounded-md bg-background shadow-sm"> {/* Reduced margin/padding */}
              <div className="flex space-x-1 items-center"> {/* Reduced spacing */}
                <Input
                  value={newSubtaskInputs[goal.id] || ''}
                  onChange={(e) => handleSubtaskInputChange(goal.id, e.target.value)}
                  placeholder="Add a sub-goal/task..."
                  className="h-7 text-xs flex-grow" // Reduced height
                  onKeyPress={(e) => handleKeyPressSubtask(e, goal.id, undefined)}
                  autoFocus
                />
                <Button onClick={() => addSubtaskToGoalOrSubtask(goal.id, undefined)} size="sm" className="h-7 px-2 text-[10px] shrink-0"> {/* Reduced button size */}
                  <CornerDownRight className="mr-0.5 h-3 w-3" /> Add {/* Reduced icon */}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setShowAddChildInputFor(null)} className="h-7 w-7 text-[10px] shrink-0"> {/* Reduced button size */}
                  <X className="h-3.5 w-3.5" /> {/* Reduced icon */}
                </Button>
              </div>
            </div>
          )}
        </div>
        <div className={cn("flex items-center space-x-0.5 mt-1 pt-1.5", isSmallScreen ? "pl-6" : "pl-7")}> {/* Reduced spacing & margin */}
          <Button variant="outline" size="sm" className="h-7 text-[10px] border-dashed" onClick={() => setShowAddChildInputFor(goal.id)} title="Add Sub-Goal/Task"> {/* Reduced button size */}
            <Plus className="mr-0.5 h-3 w-3" /> Sub {/* Reduced icon & text */}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => deleteGoal(goal.id)} title="Delete Goal"> {/* Reduced button size */}
            <Trash2 className="h-3.5 w-3.5" /> {/* Reduced icon */}
          </Button>
        </div>
      </div>
      <div ref={childrenColumnRef} className={cn("flex flex-col min-h-0", isSmallScreen ? "w-1/2" : "w-2/3")}>
        {hasChildren ? (
          <>
            {subTasksToDisplay.map(subtask => (
              <ChildRow key={subtask.id} subtask={subtask} goalId={goal.id} props={props} isSmallScreen={isSmallScreen} />
            ))}
            {hasMoreThanThreeChildren && !showAllSubGoals && (
              <div className="p-1.5 border-t border-border/50 text-center"> {/* Reduced padding */}
                <Button
                  variant="link"
                  className="text-[10px] text-primary h-auto p-0.5" // Reduced font size, padding
                  onClick={() => setShowAllSubGoals(true)}
                >
                  See all {goal.subtasks.length} <ChevronDown className="ml-0.5 h-2.5 w-2.5" /> {/* Reduced icon */}
                </Button>
              </div>
            )}
            {hasMoreThanThreeChildren && showAllSubGoals && (
              <div className="p-1.5 border-t border-border/50 text-center"> {/* Reduced padding */}
                <Button
                  variant="link"
                  className="text-[10px] text-primary h-auto p-0.5" // Reduced font size, padding
                  onClick={() => setShowAllSubGoals(false)}
                >
                  Show less <ChevronUp className="ml-0.5 h-2.5 w-2.5" /> {/* Reduced icon */}
                </Button>
              </div>
            )}
          </>
        ) : (
            <div className="p-2 text-center text-xs text-muted-foreground italic flex-grow flex items-center justify-center">No sub-goals or tasks.</div> // Reduced padding
        )}
      </div>
    </div>
  );
};

export const GoalsTableView: React.FC<GoalsTableViewProps> = (props) => {
  const { goals } = props;
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsSmallScreen(window.innerWidth < 768); // Tailwind's 'md' breakpoint
    };
    if (typeof window !== 'undefined') {
        checkScreenSize();
        window.addEventListener('resize', checkScreenSize);
        return () => window.removeEventListener('resize', checkScreenSize);
    }
  }, []);

  if (goals.length === 0) {
    return (
         <Card className="shadow-sm border"> {/* Reduced shadow */}
            <CardContent className="p-0">
                <div className="p-6 text-center text-muted-foreground text-xs"> {/* Reduced padding & font */}
                    No goals yet. Add one using the form at the top of the page.
                </div>
            </CardContent>
         </Card>
    );
  }

  const headerBaseClass = "p-2 border-primary/30 font-semibold text-xs text-primary sticky top-0 z-10 bg-muted/60"; // Reduced padding & font

  return (
    <Card className="shadow-sm border overflow-hidden"> {/* Reduced shadow */}
      <CardContent className="p-0">
        <div className="flex border-b-2 border-primary/40">
          <div className={cn(headerBaseClass, isSmallScreen ? "w-1/2 border-r" : "w-1/3 border-r")}>Goal</div>
          <div className={cn(headerBaseClass, isSmallScreen ? "w-1/2" : "w-1/3 border-r")}>Sub-Goal / Task</div>
          {!isSmallScreen && (
            <div className={cn(headerBaseClass, "w-1/3")}>Further Breakdown / Actions</div>
          )}
        </div>
        <div className="flex flex-col">
          {goals.map(goal => (
            <GoalRow key={goal.id} goal={goal} props={props} isSmallScreen={isSmallScreen} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

