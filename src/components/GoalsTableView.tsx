
"use client";

import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, PlusCircle, ChevronDown, ChevronRight, CornerDownRight, X } from 'lucide-react';
import type { Goal, Subtask } from '@/lib/types';
import { cn, truncateText, calculateGoalProgress } from '@/lib/utils';
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from 'date-fns';

interface GoalsTableViewProps {
  goals: Goal[];
  expandedSubtasks: Record<string, boolean>;
  toggleSubtaskExpansion: (itemId: string) => void;
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

interface TableViewItemProps extends GoalsTableViewProps {
  item: Goal | Subtask;
  itemType: 'goal' | 'subtask';
  goalId: string; // ID of the top-level goal this item belongs to (or is)
  depth: number;
}

const TableViewItem: React.FC<TableViewItemProps> = ({
  item, itemType, goalId, depth,
  expandedSubtasks, toggleSubtaskExpansion,
  newSubtaskInputs, handleSubtaskInputChange, handleKeyPressSubtask, addSubtaskToGoalOrSubtask,
  toggleSubtaskCompletion, showAddChildInputFor, setShowAddChildInputFor,
  handleCreateTaskFromSubtask, deleteSubtaskFromGoal, deleteGoal
}) => {
  const isGoal = itemType === 'goal';
  const currentItem = item as any;

  const id = currentItem.id;
  const name = currentItem.name;
  const subtasks = currentItem.subtasks || [];
  const completed = isGoal ? false : (item as Subtask).completed; // Goals don't have a direct completed status here
  const progress = isGoal ? calculateGoalProgress(item as Goal) : 0;
  const dueDate = isGoal ? (item as Goal).dueDate : undefined;


  let bgClass = 'bg-card hover:bg-muted/30 transition-colors duration-150';
  let textColorClass = 'text-card-foreground';
  if (isGoal) {
    bgClass = 'bg-secondary/30 hover:bg-secondary/40';
    textColorClass = 'text-primary font-medium';
  } else if (completed) {
    bgClass = 'bg-muted/70 hover:bg-muted/80 opacity-80';
    textColorClass = 'text-muted-foreground line-through';
  } else if (depth === 0) { // Top-level subtask under a goal
    bgClass = 'bg-card hover:bg-muted/30';
  } else { // Deeper subtasks
    bgClass = 'bg-muted/20 hover:bg-muted/30';
  }


  return (
    <>
      <TableRow className={cn(bgClass, isGoal && "border-b-2 border-primary/20")}>
        <TableCell style={{ paddingLeft: `${(depth * 1.25) + 0.75}rem` }} className="py-2.5 align-middle">
          <div className="flex items-center space-x-1.5 min-w-0">
            {subtasks.length > 0 ? (
              <Button variant="ghost" size="icon" onClick={() => toggleSubtaskExpansion(id)} className="h-7 w-7 shrink-0">
                {expandedSubtasks[id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            ) : (
              <span className="w-7 inline-block shrink-0"></span>
            )}
            {!isGoal && (
              <Checkbox
                id={`tv-item-${id}`}
                checked={completed}
                onCheckedChange={() => toggleSubtaskCompletion(goalId, id)}
                className="shrink-0 h-4 w-4 border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                aria-label={`Mark ${name} as ${completed ? 'incomplete' : 'complete'}`}
              />
            )}
            <Label htmlFor={!isGoal ? `tv-item-${id}` : undefined} className={cn("text-sm truncate", textColorClass, completed ? 'cursor-default' : 'cursor-pointer')} title={name}>
              {truncateText(name, 50 - depth * 4)}
            </Label>
            {isGoal && <Badge variant={progress === 100 ? "default" : "secondary"} className="ml-2 text-xs shrink-0 h-5 px-2">{progress}%</Badge>}
            {isGoal && dueDate && (
                <span className="text-xs text-muted-foreground ml-2 shrink-0 whitespace-nowrap">(Due: {format(parseISO(dueDate), 'MMM d')})</span>
            )}
          </div>
        </TableCell>
        <TableCell className="py-2.5 align-middle text-right pr-3">
          <div className="flex items-center space-x-1 justify-end">
            <Button variant="outline" size="icon" className={cn("h-7 w-7 border-dashed", completed ? "text-muted-foreground cursor-not-allowed border-muted" : "text-card-foreground border-current hover:border-primary hover:text-primary")}
              onClick={() => !completed && setShowAddChildInputFor(id)}
              disabled={completed} title={isGoal ? "Add Top-Level Subtask" : "Add Child Subtask"}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
            {!isGoal && (
              <Button variant="outline" size="icon" className={cn("h-7 w-7", completed ? "text-muted-foreground border-muted cursor-not-allowed" : "text-primary border-primary hover:bg-primary/10")}
                onClick={() => !completed && handleCreateTaskFromSubtask(item as Subtask)}
                disabled={completed} title="Create Calendar Task">
                <PlusCircle className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10"
              onClick={() => isGoal ? deleteGoal(id) : deleteSubtaskFromGoal(goalId, id)}
              title={isGoal ? "Delete Goal" : "Delete Subtask"}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {/* Input row for adding child/top-level subtask */}
      {showAddChildInputFor === id && (
        <TableRow className="bg-card shadow-inner">
          <TableCell colSpan={2} className="py-2 pr-2" style={{ paddingLeft: `${(depth + (isGoal ? 0 : 1)) * 1.25 + 0.75}rem` }}>
            <div className="flex space-x-2 items-center">
              <Input
                value={newSubtaskInputs[id] || ''}
                onChange={(e) => handleSubtaskInputChange(id, e.target.value)}
                placeholder={isGoal ? "Add a top-level subtask..." : "Add a child subtask..."}
                className="h-8 text-xs flex-grow"
                onKeyPress={(e) => handleKeyPressSubtask(e, goalId, isGoal ? undefined : id)}
                autoFocus
              />
              <Button onClick={() => addSubtaskToGoalOrSubtask(goalId, isGoal ? undefined : id)} size="sm" className="h-8 px-2.5 text-xs shrink-0">
                <CornerDownRight className="mr-1 h-3 w-3" /> Add
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setShowAddChildInputFor(null)} className="h-8 w-8 text-xs shrink-0">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
      )}

      {expandedSubtasks[id] && subtasks.map((subItem: Subtask) => (
        <TableViewItem
          key={subItem.id}
          item={subItem}
          itemType="subtask"
          goalId={goalId}
          depth={depth + 1}
          // Pass all props down
          expandedSubtasks={expandedSubtasks}
          toggleSubtaskExpansion={toggleSubtaskExpansion}
          newSubtaskInputs={newSubtaskInputs}
          handleSubtaskInputChange={handleSubtaskInputChange}
          handleKeyPressSubtask={handleKeyPressSubtask}
          addSubtaskToGoalOrSubtask={addSubtaskToGoalOrSubtask}
          toggleSubtaskCompletion={toggleSubtaskCompletion}
          showAddChildInputFor={showAddChildInputFor}
          setShowAddChildInputFor={setShowAddChildInputFor}
          handleCreateTaskFromSubtask={handleCreateTaskFromSubtask}
          deleteSubtaskFromGoal={deleteSubtaskFromGoal}
          deleteGoal={deleteGoal} // Technically won't be used by subtask, but keep consistent
        />
      ))}
    </>
  );
};


export const GoalsTableView: React.FC<GoalsTableViewProps> = ({ goals, ...props }) => {
  return (
    <Card className="shadow-md border">
      <CardContent className="p-0">
        <Table className="min-w-full table-fixed">
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="py-3 pl-4 w-[70%]">Task / Subtask</TableHead>
              <TableHead className="w-[30%] text-right py-3 pr-3">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {goals.map(goal => (
              <TableViewItem
                key={goal.id}
                item={goal}
                itemType="goal"
                goalId={goal.id} 
                depth={0} // Goals are at depth 0
                {...props}
              />
            ))}
            {goals.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-muted-foreground py-10">
                  No goals yet. Switch to Accordion view to add a new goal using the form at the top.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
