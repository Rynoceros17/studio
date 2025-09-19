
// src/app/goals/page.tsx
"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import useLocalStorage from '@/hooks/useLocalStorage';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, PlusCircle, ArrowLeft, CornerDownRight, ChevronDown, ChevronRight, X, GripVertical, Calendar as CalendarIcon, ListTree, Rows } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { cn, truncateText, calculateGoalProgress } from '@/lib/utils';
import type { Subtask, Goal, Task } from '@/lib/types';
import { TaskForm } from '@/components/TaskForm';
import { GoalsTableView } from '@/components/GoalsTableView';
import {
  Dialog,
  DialogContent,
  DialogHeader as FormDialogHeader, // Aliased to avoid conflict
  DialogTitle as FormDialogTitle,
} from "@/components/ui/dialog";
import { format, parseISO, isValid } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';


import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';


// Helper function to recursively find and update a subtask
const findAndOperateOnSubtask = (
  subtasks: Subtask[],
  targetId: string,
  operation: (subtask: Subtask) => Subtask | null // Return null to delete
): Subtask[] => {
  return subtasks.map(st => {
    if (st.id === targetId) {
      return operation(st);
    }
    if (st.subtasks) {
      const updatedChildren = findAndOperateOnSubtask(st.subtasks, targetId, operation);
      if (updatedChildren !== st.subtasks) {
          return { ...st, subtasks: updatedChildren.filter(Boolean) as Subtask[] };
      }
    }
    return st;
  }).filter(Boolean) as Subtask[];
};

// Helper function to recursively add a subtask to a parent
const addSubtaskToParentRecursive = (
    subtasks: Subtask[],
    parentId: string,
    newSubtask: Subtask
): Subtask[] => {
    return subtasks.map(st => {
        if (st.id === parentId) {
            return { ...st, subtasks: [...(st.subtasks || []), newSubtask] };
        }
        if (st.subtasks) {
            return { ...st, subtasks: addSubtaskToParentRecursive(st.subtasks, parentId, newSubtask) };
        }
        return st;
    });
};

// Props for SortableListItem
interface SortableListItemProps {
    subtask: Subtask;
    goalId: string;
    depth: number;
    expandedSubtasks: Record<string, boolean>;
    toggleSubtaskExpansion: (subtaskId: string) => void;
    newSubtaskInputs: Record<string, string>;
    handleSubtaskInputChange: (parentId: string, value: string) => void;
    handleKeyPressSubtask: (event: React.KeyboardEvent<HTMLInputElement>, goalId: string, parentSubtaskId?: string) => void;
    addSubtask: (goalId: string, parentSubtaskId?: string) => void;
    toggleSubtaskCompletion: (goalId: string, subtaskIdToToggle: string) => void;
    showAddChildInputFor: string | null;
    setShowAddChildInputFor: (id: string | null) => void;
    handleCreateTaskFromSubtask: (subtask: Subtask) => void;
    deleteSubtask: (goalId: string, subtaskIdToDelete: string) => void;
    renderSubtasksFunction: (subtasks: Subtask[], goalId: string, depth: number) => JSX.Element;
}

// Component to render a single sortable subtask item
function SortableListItem({
    subtask, goalId, depth, expandedSubtasks, toggleSubtaskExpansion,
    newSubtaskInputs, handleSubtaskInputChange, handleKeyPressSubtask, addSubtask,
    toggleSubtaskCompletion, showAddChildInputFor, setShowAddChildInputFor,
    handleCreateTaskFromSubtask, deleteSubtask, renderSubtasksFunction
}: SortableListItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: subtask.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: transition || 'transform 0.25s ease',
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 100 : 'auto',
    };

    let bgClass = 'bg-card';
    let textColorClass = 'text-card-foreground';
    let expandChevronColorClass = 'text-card-foreground';

    if (subtask.completed) {
        bgClass = 'bg-muted opacity-70';
        textColorClass = 'text-muted-foreground';
        expandChevronColorClass = 'text-muted-foreground';
    } else if (depth === 0) {
        bgClass = 'bg-secondary/70';
        textColorClass = 'text-card-foreground';
    } else if (depth === 1) {
        bgClass = 'bg-muted/50';
        textColorClass = 'text-card-foreground';
    }
    // Deeper levels (depth >= 2) use default bg-card


    return (
        <div ref={setNodeRef} style={style} className="mb-0.5">
            <div
                className={cn(
                    `flex items-center justify-between space-x-2 p-2.5 rounded-md border shadow-sm`,
                    bgClass
                )}
            >
                <div className="flex items-center space-x-1.5 flex-grow min-w-0">
                    <button
                        {...attributes}
                        {...listeners}
                        type="button"
                        className={cn("p-1 rounded cursor-grab hover:bg-black/10 active:cursor-grabbing", textColorClass, subtask.completed && "cursor-not-allowed opacity-50")}
                        aria-label="Drag to reorder subtask"
                        disabled={subtask.completed}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <GripVertical className="h-4 w-4" />
                    </button>

                    {(subtask.subtasks && subtask.subtasks.length > 0) ? (
                         <Button variant="ghost" size="icon" onClick={() => toggleSubtaskExpansion(subtask.id)} className={cn("h-6 w-6 shrink-0", expandChevronColorClass, `hover:bg-transparent hover:opacity-75` )}>
                            {expandedSubtasks[subtask.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                    ) : (
                        <div className="w-6 shrink-0"></div>
                    )}
                    <Checkbox
                        id={`subtask-${subtask.id}`}
                        checked={subtask.completed}
                        onCheckedChange={() => toggleSubtaskCompletion(goalId, subtask.id)}
                        className={cn(
                            "shrink-0 h-5 w-5 border-primary",
                            "data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                        )}
                        aria-label={`Mark subtask ${subtask.name} as ${subtask.completed ? 'incomplete' : 'complete'}`}
                    />
                    <Label
                        htmlFor={`subtask-${subtask.id}`}
                        className={cn(
                            "text-sm truncate cursor-pointer",
                            textColorClass,
                            subtask.completed && "line-through"
                        )}
                        title={subtask.name}
                    >
                        {truncateText(subtask.name, 30)}
                    </Label>
                </div>
                <div className="flex items-center shrink-0 space-x-1.5">
                    <Button
                        variant="outline"
                        size="icon"
                        className={cn(
                            "h-7 w-7 border-dashed",
                            subtask.completed ? "text-muted-foreground cursor-not-allowed" : textColorClass,
                            subtask.completed ? "border-muted" : "border-current",
                            !subtask.completed && "hover:border-primary hover:text-primary"
                        )}
                        onClick={() => !subtask.completed && setShowAddChildInputFor(subtask.id)}
                        aria-label={`Add child subtask to ${subtask.name}`}
                        title="Add Child Subtask"
                        disabled={subtask.completed}
                    >
                        <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        className={cn(
                            "h-7 w-7",
                            subtask.completed ? "text-muted-foreground border-muted cursor-not-allowed" : "text-primary border-primary hover:bg-primary/10"
                        )}
                        onClick={() => !subtask.completed && handleCreateTaskFromSubtask(subtask)}
                        aria-label={`Create calendar task for ${subtask.name}`}
                        title="Create Calendar Task"
                        disabled={subtask.completed}
                    >
                        <PlusCircle className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn("h-7 w-7 text-destructive hover:bg-destructive/10")}
                        onClick={() => deleteSubtask(goalId, subtask.id)}
                        aria-label={`Delete subtask ${subtask.name}`}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            <div className="my-1">
                {showAddChildInputFor === subtask.id && (
                    <div className="flex space-x-2 items-center p-2 border rounded-md bg-card shadow">
                        <Input
                            value={newSubtaskInputs[subtask.id] || ''}
                            onChange={(e) => handleSubtaskInputChange(subtask.id, e.target.value)}
                            placeholder="Add a child subtask..."
                            className="h-8 text-xs flex-grow"
                            onKeyPress={(e) => handleKeyPressSubtask(e, goalId, subtask.id)}
                            autoFocus
                        />
                        <Button onClick={() => addSubtask(goalId, subtask.id)} size="sm" className="h-8 px-2.5 text-xs shrink-0">
                            <CornerDownRight className="mr-1 h-3 w-3" /> Add
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setShowAddChildInputFor(null)} className="h-8 w-8 text-xs shrink-0">
                            <X className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                )}
            </div>

            {subtask.subtasks && subtask.subtasks.length > 0 && expandedSubtasks[subtask.id] && (
                <div className="pl-0">
                   {renderSubtasksFunction(subtask.subtasks, goalId, depth + 1)}
                </div>
            )}
        </div>
    );
}

// Simple component for DragOverlay
function DraggingSubtaskItem({ name }: { name: string }) {
    return (
        <Card className="p-2.5 rounded-md shadow-xl bg-primary text-primary-foreground border-primary">
            <p className="text-sm truncate">{name}</p>
        </Card>
    );
}


export default function GoalsPage() {
    const [goals, setGoals] = useLocalStorage<Goal[]>('weekwise-goals', []);
    const [newGoalName, setNewGoalName] = useState('');
    const [newGoalDueDate, setNewGoalDueDate] = useState<Date | undefined>(undefined);
    const [isGoalDatePickerOpen, setIsGoalDatePickerOpen] = useState(false);
    const [newSubtaskInputs, setNewSubtaskInputs] = useState<Record<string, string>>({});
    const { toast } = useToast();

    const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
    const [prefilledTaskData, setPrefilledTaskData] = useState<Partial<Task> | null>(null);
    const [tasks, setTasks] = useLocalStorage<Task[]>('weekwise-tasks', []);

    const [expandedSubtasks, setExpandedSubtasks] = useState<Record<string, boolean>>({});
    const [showAddChildInputFor, setShowAddChildInputFor] = useState<string | null>(null);
    const [isClient, setIsClient] = useState(false);
    const [activeDraggedItem, setActiveDraggedItem] = useState<Subtask | null>(null);
    const [viewMode, setViewMode] = useState<'table' | 'accordion'>('table');


    useEffect(() => {
        setIsClient(true);
    }, []);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const findSubtaskByIdRecursive = (subtasks: Subtask[], id: string): Subtask | null => {
        for (const subtask of subtasks) {
            if (subtask.id === id) return subtask;
            if (subtask.subtasks) {
                const found = findSubtaskByIdRecursive(subtask.subtasks, id);
                if (found) return found;
            }
        }
        return null;
    };

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        let draggedItem: Subtask | null = null;
        for (const goal of goals) {
            draggedItem = findSubtaskByIdRecursive(goal.subtasks, active.id as string);
            if (draggedItem) break;
        }
        setActiveDraggedItem(draggedItem);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveDraggedItem(null);
        const { active, over } = event;

        if (!over || active.id === over.id) {
            return;
        }

        const activeId = active.id as string;
        const overId = over.id as string;

        setGoals((currentGoals) => {
            const newGoals = JSON.parse(JSON.stringify(currentGoals)) as Goal[];
            const reorderInList = (list: Subtask[]): boolean => {
                const activeItemIndex = list.findIndex(item => item.id === activeId);
                const overItemIndex = list.findIndex(item => item.id === overId);

                if (activeItemIndex !== -1 && overItemIndex !== -1) {

                    const reorderedList = arrayMove(list, activeItemIndex, overItemIndex);
                    list.length = 0;
                    list.push(...reorderedList);
                    return true;
                }

                for (const item of list) {
                    if (item.subtasks && item.subtasks.length > 0) {
                        if (reorderInList(item.subtasks)) {
                            return true;
                        }
                    }
                }
                return false;
            };

            for (const goal of newGoals) {
                if (reorderInList(goal.subtasks)) {
                    break;
                }
            }
            return newGoals;
        });
    };


    const toggleSubtaskExpansion = (subtaskId: string) => {
        setExpandedSubtasks(prev => ({ ...prev, [subtaskId]: !prev[subtaskId] }));
    };

    const parseISOStrict = (dateString: string | undefined): Date | null => {
        if (!dateString) return null;
        const datePart = dateString.split('T')[0];
        const date = parseISO(datePart + 'T00:00:00');
        if (isNaN(date.getTime())) return null;
        return date;
    };

    const addTask = (newTaskData: Omit<Task, 'id'>) => {
       const newTask: Task = { ...newTaskData, id: crypto.randomUUID(), details: newTaskData.details ?? '', dueDate: newTaskData.dueDate, recurring: newTaskData.recurring ?? false, highPriority: newTaskData.highPriority ?? false, exceptions: [] };
       setTasks(prevTasks => {
           const updatedTasks = [...prevTasks, newTask];
           updatedTasks.sort((a, b) => {
               const dateA = parseISOStrict(a.date); const dateB = parseISOStrict(b.date);
               if (!dateA && !dateB) return 0; if (!dateA) return 1; if (!dateB) return -1;
               const dateComparison = dateA.getTime() - dateB.getTime();
               if (dateComparison !== 0) return dateComparison;
               if (a.highPriority !== b.highPriority) return a.highPriority ? -1 : 1;
               return 0;
           });
           return updatedTasks;
       });
       const taskDate = parseISOStrict(newTaskData.date);
       toast({ title: "Task Added", description: `"${newTaskData.name}" added${taskDate ? ` for ${format(taskDate, 'PPP')}` : ''}.` });
       setIsTaskFormOpen(false); setPrefilledTaskData(null);
    };


    const addGoal = () => {
        if (!newGoalName.trim()) {
            toast({ title: "Missing Goal Name", description: "Please provide a name for the goal.", variant: "destructive" }); return;
        }
        const newGoal: Goal = {
            id: crypto.randomUUID(),
            name: newGoalName.trim(),
            dueDate: newGoalDueDate ? format(newGoalDueDate, 'yyyy-MM-dd') : undefined,
            subtasks: []
        };
        setGoals(prev => [...prev, newGoal]);
        setNewGoalName('');
        setNewGoalDueDate(undefined);
        toast({ title: "Goal Added", description: `"${newGoal.name}" ${newGoal.dueDate ? `(Due: ${format(parseISO(newGoal.dueDate), 'PPP')})` : ''} added successfully.` });
    };

    const deleteGoal = (id: string) => {
        const goalToDelete = goals.find(g => g.id === id);
        setGoals(prev => prev.filter(goal => goal.id !== id));
        if (goalToDelete) toast({ title: "Goal Removed", description: `"${goalToDelete.name}" removed.`, variant: "destructive" });
    };

    const handleSubtaskInputChange = (parentId: string, value: string) => {
        setNewSubtaskInputs(prev => ({ ...prev, [parentId]: value }));
    };

    const addSubtaskToGoalOrSubtask = (goalId: string, parentSubtaskId?: string) => { // Renamed
        const parentId = parentSubtaskId || goalId;
        const subtaskName = newSubtaskInputs[parentId]?.trim();

        if (!subtaskName) {
            toast({ title: "Missing Subtask Name", description: "Please provide a name for the subtask.", variant: "destructive" }); return;
        }

        const newSubtask: Subtask = { id: crypto.randomUUID(), name: subtaskName, completed: false, subtasks: [] };

        setGoals(prevGoals => prevGoals.map(goal => {
            if (goal.id === goalId) {
                if (!parentSubtaskId) { // Adding to a top-level goal
                    return { ...goal, subtasks: [...goal.subtasks, newSubtask] };
                } else { // Adding to an existing subtask
                    const updatedSubtasks = addSubtaskToParentRecursive(goal.subtasks, parentSubtaskId, newSubtask);
                    return { ...goal, subtasks: updatedSubtasks };
                }
            }
            return goal;
        }));

        setNewSubtaskInputs(prev => ({ ...prev, [parentId]: '' }));
        toast({ title: "Subtask Added", description: `Subtask "${newSubtask.name}" added.` });
        setShowAddChildInputFor(null);
        if (parentSubtaskId) {
            setExpandedSubtasks(prev => ({ ...prev, [parentSubtaskId]: true }));
        }
    };

    const deleteSubtaskRecursive = (subtasks: Subtask[], subtaskIdToDelete: string): { updatedSubtasks: Subtask[], foundAndDeleted: boolean, deletedSubtaskName?: string } => {
        let foundAndDeleted = false;
        let deletedName: string | undefined;
        const filteredSubtasks = subtasks.filter(st => {
            if (st.id === subtaskIdToDelete) {
                foundAndDeleted = true;
                deletedName = st.name;
                return false;
            }
            return true;
        });

        if (foundAndDeleted) {
            return { updatedSubtasks: filteredSubtasks, foundAndDeleted: true, deletedSubtaskName: deletedName };
        }


        const result = { updatedSubtasks: [] as Subtask[], foundAndDeleted: false, deletedSubtaskName: undefined as string | undefined };
        result.updatedSubtasks = subtasks.map(st => {
            if (st.subtasks) {
                const childResult = deleteSubtaskRecursive(st.subtasks, subtaskIdToDelete);
                if (childResult.foundAndDeleted) {
                    foundAndDeleted = true;
                    deletedName = childResult.deletedSubtaskName;
                    return { ...st, subtasks: childResult.updatedSubtasks };
                }
            }
            return st;
        });
        result.foundAndDeleted = foundAndDeleted;
        result.deletedSubtaskName = deletedName;
        return result;
    };

    const deleteSubtaskFromGoal = (goalId: string, subtaskIdToDelete: string) => { // Renamed
        setGoals(prevGoals => prevGoals.map(goal => {
            if (goal.id === goalId) {
                const { updatedSubtasks, foundAndDeleted, deletedSubtaskName } = deleteSubtaskRecursive(goal.subtasks, subtaskIdToDelete);
                if (foundAndDeleted && deletedSubtaskName) {
                     toast({ title: "Subtask Removed", description: `Subtask "${deletedSubtaskName}" and its children removed.`, variant: "destructive" });
                }
                return { ...goal, subtasks: updatedSubtasks };
            }
            return goal;
        }));
    };

    const toggleSubtaskCompletion = (goalId: string, subtaskIdToToggle: string) => {
        setGoals(prevGoals => prevGoals.map(goal => {
            if (goal.id === goalId) {
                const newSubtasks = findAndOperateOnSubtask(goal.subtasks, subtaskIdToToggle, st => ({
                    ...st,
                    completed: !st.completed
                }));
                return { ...goal, subtasks: newSubtasks };
            }
            return goal;
        }));
    };


    const handleKeyPressGoal = (event: React.KeyboardEvent<HTMLInputElement>) => { if (event.key === 'Enter') addGoal(); };
    const handleKeyPressSubtask = (event: React.KeyboardEvent<HTMLInputElement>, goalId: string, parentSubtaskId?: string) => {
        if (event.key === 'Enter') {
            addSubtaskToGoalOrSubtask(goalId, parentSubtaskId);
        }
    };

    const handleCreateTaskFromSubtask = (subtask: Subtask) => {
        setPrefilledTaskData({ name: subtask.name });
        setIsTaskFormOpen(true);
    };


    const renderAccordionSubtasks = (subtasksToRender: Subtask[], goalId: string, currentDepth: number): JSX.Element => { // Renamed for clarity
        return (
          <SortableContext items={subtasksToRender.map(st => st.id)} strategy={verticalListSortingStrategy}>
            <div className={cn(currentDepth > 0 && "pl-0")}>
              {subtasksToRender.map(subtask => (
                <SortableListItem
                  key={subtask.id}
                  subtask={subtask}
                  goalId={goalId}
                  depth={currentDepth}
                  expandedSubtasks={expandedSubtasks}
                  toggleSubtaskExpansion={toggleSubtaskExpansion}
                  newSubtaskInputs={newSubtaskInputs}
                  handleSubtaskInputChange={handleSubtaskInputChange}
                  handleKeyPressSubtask={handleKeyPressSubtask}
                  addSubtask={addSubtaskToGoalOrSubtask}
                  toggleSubtaskCompletion={toggleSubtaskCompletion}
                  showAddChildInputFor={showAddChildInputFor}
                  setShowAddChildInputFor={setShowAddChildInputFor}
                  handleCreateTaskFromSubtask={handleCreateTaskFromSubtask}
                  deleteSubtask={deleteSubtaskFromGoal}
                  renderSubtasksFunction={renderAccordionSubtasks}
                />
              ))}
            </div>
          </SortableContext>
        );
    };


    return (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
            <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b">
                    <div className="flex items-center gap-4 mb-4 sm:mb-0">
                        <Link href="/" passHref legacyBehavior>
                            <Button variant="outline" size="icon" className="text-primary border-primary hover:bg-primary/10 hover:text-foreground dark:hover:text-primary-foreground h-10 w-10">
                                <ArrowLeft className="h-5 w-5" />
                                <span className="sr-only">Back to Calendar</span>
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-semibold text-primary">Manage Your Goals</h1>
                            <p className="text-sm text-muted-foreground">
                                {viewMode === 'accordion'
                                    ? "Create goals, break them into subtasks, track progress, and drag to reorder."
                                    : "View goals and subtasks in a hierarchical table. Use the form to add new goals."}
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => setViewMode(viewMode === 'accordion' ? 'table' : 'accordion')}
                        className="sm:ml-auto"
                        aria-label={`Switch to ${viewMode === 'accordion' ? 'Table' : 'Accordion'} View`}
                    >
                        {viewMode === 'accordion' ? <ListTree className="mr-2 h-4 w-4" /> : <Rows className="mr-2 h-4 w-4" />}
                        Switch to {viewMode === 'accordion' ? 'Table' : 'Accordion'} View
                    </Button>
                </div>

                {/* "Add New Goal" form is now always visible at the top */}
                <div className="p-4 border rounded-md bg-secondary/30 shadow-sm space-y-3">
                    <div>
                        <Label htmlFor="goal-name" className="text-sm font-medium text-muted-foreground mb-1 block">New Goal Name</Label>
                        <div className="flex space-x-2">
                            <Input id="goal-name" value={newGoalName} onChange={(e) => setNewGoalName(e.target.value)} placeholder="e.g., Complete online course" className="h-10 text-base md:text-sm flex-grow" onKeyPress={handleKeyPressGoal}/>
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="goal-due-date" className="text-sm font-medium text-muted-foreground mb-1 block">Due Date (Optional)</Label>
                        <Popover open={isGoalDatePickerOpen} onOpenChange={setIsGoalDatePickerOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full justify-start text-left font-normal h-10",
                                        !newGoalDueDate && "text-muted-foreground"
                                    )}
                                    onClick={() => setIsGoalDatePickerOpen(true)}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {newGoalDueDate ? format(newGoalDueDate, "PPP") : <span>Pick a due date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={newGoalDueDate}
                                    onSelect={(date) => { setNewGoalDueDate(date); setIsGoalDatePickerOpen(false); }}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                    <Button onClick={addGoal} size="default" className="h-10 w-full"><Plus className="mr-2 h-4 w-4" /> Add Goal</Button>
                </div>

                {/* Goals Display Area */}
                {!isClient ? (
                     <p className="text-base text-muted-foreground text-center py-8">Loading goals...</p>
                ) : goals.length === 0 ? (
                    <p className="text-base text-muted-foreground text-center py-8">No goals yet. Add one using the form above to get started!</p>
                ) : viewMode === 'accordion' ? (
                    <ScrollArea className="max-h-[calc(100vh-350px)]"> {/* Adjusted height for accordion view */}
                         <div className="space-y-4 pr-2">
                            <Accordion type="multiple" className="w-full">
                                {goals.map((goal) => {
                                    const progress = calculateGoalProgress(goal);
                                    return (
                                        <AccordionItem key={goal.id} value={goal.id} className="border-none mb-4">
                                            <Card className="overflow-hidden shadow-md border hover:shadow-lg transition-shadow duration-200 bg-card">
                                                <CardHeader className="p-0 flex flex-row items-center justify-between space-x-2 hover:bg-muted/30 rounded-t-md transition-colors">
                                                    <AccordionTrigger className="flex-grow p-4 text-base font-medium text-left text-primary hover:no-underline">
                                                        <div className="flex flex-col min-w-0">
                                                            <div className="flex items-center space-x-3">
                                                                <span className="truncate whitespace-nowrap overflow-hidden text-ellipsis" title={goal.name}>{truncateText(goal.name, 40)}</span>
                                                                <Badge variant={progress === 100 ? "default" : "secondary"} className="text-xs shrink-0 h-6 px-2.5">{progress}%</Badge>
                                                            </div>
                                                            {goal.dueDate && isValid(parseISO(goal.dueDate)) && (
                                                                <span className="text-xs text-muted-foreground mt-1">
                                                                    Due: {format(parseISO(goal.dueDate), 'MMM d, yyyy')}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </AccordionTrigger>
                                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10 mr-3 shrink-0" onClick={(e) => { e.stopPropagation(); deleteGoal(goal.id); }} aria-label={`Delete goal ${goal.name}`}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </CardHeader>
                                                <AccordionContent>
                                                    <CardContent className="p-4 space-y-4 border-t bg-muted/20">
                                                        <Progress value={progress} className="h-2.5" />
                                                        <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                                                            {goal.subtasks.length === 0 ? (
                                                                <p className="text-sm text-muted-foreground italic text-center py-2">No subtasks yet. Add one below.</p>
                                                            ) : (
                                                                renderAccordionSubtasks(goal.subtasks, goal.id, 0)
                                                            )}
                                                        </div>
                                                        <div className="flex space-x-2 pt-3 border-t mt-3">
                                                            <Input
                                                                value={newSubtaskInputs[goal.id] || ''}
                                                                onChange={(e) => handleSubtaskInputChange(goal.id, e.target.value)}
                                                                placeholder="Add a top-level subtask..."
                                                                className="h-9 text-sm flex-grow bg-card"
                                                                onKeyPress={(e) => handleKeyPressSubtask(e, goal.id)}
                                                            />
                                                            <Button onClick={() => addSubtaskToGoalOrSubtask(goal.id)} size="sm" className="h-9 px-3">
                                                                <Plus className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </CardContent>
                                                </AccordionContent>
                                            </Card>
                                        </AccordionItem>
                                    );
                                })}
                            </Accordion>
                         </div>
                    </ScrollArea>
                ) : ( // Table View
                    <GoalsTableView
                        goals={goals}
                        newSubtaskInputs={newSubtaskInputs}
                        handleSubtaskInputChange={handleSubtaskInputChange}
                        handleKeyPressSubtask={handleKeyPressSubtask}
                        addSubtaskToGoalOrSubtask={addSubtaskToGoalOrSubtask}
                        toggleSubtaskCompletion={toggleSubtaskCompletion}
                        showAddChildInputFor={showAddChildInputFor}
                        setShowAddChildInputFor={setShowAddChildInputFor}
                        handleCreateTaskFromSubtask={handleCreateTaskFromSubtask}
                        deleteSubtaskFromGoal={deleteSubtaskFromGoal}
                        deleteGoal={deleteGoal}
                    />
                )}

                <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
                  <FormDialogHeader><FormDialogTitle className="text-primary">{prefilledTaskData ? "Create Task from Subtask" : "Add New Task"}</FormDialogTitle></FormDialogHeader>
                     <TaskForm addTask={addTask} onTaskAdded={() => { setIsTaskFormOpen(false); setPrefilledTaskData(null); }} initialData={prefilledTaskData}/>
                </Dialog>
            </div>
            <DragOverlay>
                {activeDraggedItem ? (
                    <DraggingSubtaskItem name={activeDraggedItem.name} />
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}



    