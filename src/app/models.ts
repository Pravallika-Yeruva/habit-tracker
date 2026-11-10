export type CalendarView = 'day' | 'week' | 'month';
export type TaskColor = 'sage' | 'peach' | 'blue' | 'lavender' | 'yellow';
export type RepeatFrequency = 'none' | 'daily' | 'weekly' | 'monthly';

export const TASK_COLORS: TaskColor[] = ['sage', 'peach', 'blue', 'lavender', 'yellow'];

export interface HabitTask {
  id: string;
  title: string;
  date: string;
  completedDates: string[];
  time: string;
  reminderTime: string;
  sendNotification: boolean;
  repeat: RepeatFrequency;
  color: TaskColor;
}

export type TaskFormValue = Omit<HabitTask, 'id' | 'date' | 'completedDates'>;

export interface TaskOccurrence extends HabitTask {
  completed: boolean;
}

export interface CalendarDay {
  date: Date;
  key: string;
  dayName: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  taskCount: number;
}

export function isTaskColor(value: unknown): value is TaskColor {
  return TASK_COLORS.some((color) => color === value);
}

export function taskColorValue(color: TaskColor): string {
  const colors: Record<TaskColor, string> = {
    sage: '#78927f',
    peach: '#d98567',
    blue: '#7196b4',
    lavender: '#9a86b5',
    yellow: '#c4a34e',
  };
  return colors[color];
}
