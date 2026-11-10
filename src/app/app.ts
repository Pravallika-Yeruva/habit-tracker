import { Component, OnInit } from '@angular/core';
import {
  CalendarDay,
  CalendarView,
  HabitTask,
  isTaskColor,
  RepeatFrequency,
  TASK_COLORS,
  TaskColor,
  TaskFormValue,
  TaskOccurrence,
  taskColorValue,
} from './models';
import { DaysComponent } from './components/days/days.component';
import { TaskFormComponent } from './components/task-form/task-form.component';
import { ReminderNotificationService } from './components/reminder/reminder-notification.service';

@Component({
  imports: [DaysComponent, TaskFormComponent],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App implements OnInit {
  private readonly storageKey = 'habit-tracker-tasks';
  private readonly today = this.startOfDay(new Date());

  selectedDate = new Date(this.today);
  view: CalendarView = 'week';
  storageError = '';
  tasks: HabitTask[] = this.loadTasks();
  isAddingTask = false;
  editingTask: HabitTask | null = null;
  readonly notificationError: () => string;

  constructor(private readonly reminderNotifications: ReminderNotificationService) {
    this.notificationError = reminderNotifications.errorMessage.asReadonly();
  }

  ngOnInit(): void {
    this.reminderNotifications.sync(this.tasks);
  }

  get periodLabel(): string {
    if (this.view === 'month') {
      return this.selectedDate.toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      });
    }

    if (this.view === 'day') {
      return this.selectedDate.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    }

    const start = this.startOfWeek(this.selectedDate);
    const end = this.addDays(start, 6);
    const sameMonth = start.getMonth() === end.getMonth();

    if (sameMonth) {
      return `${start.toLocaleDateString(undefined, { month: 'long' })} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;
    }

    return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }

  get weekDays(): CalendarDay[] {
    const start = this.startOfWeek(this.selectedDate);
    return Array.from({ length: 7 }, (_, index) => this.createCalendarDay(this.addDays(start, index)));
  }

  get monthDays(): CalendarDay[] {
    const firstOfMonth = new Date(this.selectedDate.getFullYear(), this.selectedDate.getMonth(), 1);
    const calendarStart = this.startOfWeek(firstOfMonth);
    return Array.from({ length: 42 }, (_, index) =>
      this.createCalendarDay(this.addDays(calendarStart, index)),
    );
  }

  get selectedTasks(): TaskOccurrence[] {
    const selectedKey = this.toDateKey(this.selectedDate);
    return this.tasks
      .filter((task) => this.taskOccursOn(task, this.selectedDate))
      .map((task): TaskOccurrence => ({
        ...task,
        completed: task.completedDates.includes(selectedKey),
      }));
  }

  get completedTaskCount(): number {
    return this.selectedTasks.filter((task) => task.completed).length;
  }

  setView(view: CalendarView): void {
    this.view = view;
  }

  selectDate(date: Date): void {
    this.selectedDate = this.startOfDay(date);
  }

  navigatePeriod(direction: -1 | 1): void {
    if (this.view === 'month') {
      this.selectedDate = new Date(
        this.selectedDate.getFullYear(),
        this.selectedDate.getMonth() + direction,
        1,
      );
      return;
    }

    this.selectedDate = this.addDays(
      this.selectedDate,
      this.view === 'week' ? direction * 7 : direction,
    );
  }

  goToToday(): void {
    this.selectedDate = new Date(this.today);
  }

  toggleTaskForm(): void {
    if (this.isAddingTask) {
      this.cancelTaskForm();
      return;
    }

    this.editingTask = null;
    this.isAddingTask = true;
  }

  editTask(taskId: string): void {
    const task = this.tasks.find((candidate) => candidate.id === taskId);
    if (!task) {
      return;
    }

    this.editingTask = task;
    this.isAddingTask = true;
  }

  cancelTaskForm(): void {
    this.editingTask = null;
    this.isAddingTask = false;
  }

  addTask(taskDraft: TaskFormValue): void {
    const title = taskDraft.title.trim();
    if (!title || (taskDraft.reminderTime && !this.isValidTime(taskDraft.reminderTime))) {
      return;
    }

    if (this.editingTask) {
      const taskId = this.editingTask.id;
      this.tasks = this.tasks.map((task) =>
        task.id === taskId ? { ...task, ...taskDraft, title } : task,
      );
    } else {
      this.tasks = [
        ...this.tasks,
        {
          ...taskDraft,
          title,
          id: this.createTaskId(),
          date: this.toDateKey(this.selectedDate),
          completedDates: [],
        },
      ];
    }

    this.cancelTaskForm();
    this.saveTasks();
  }

  get taskColors(): TaskColor[] {
    return TASK_COLORS;
  }

  colorValue(color: TaskColor): string {
    return taskColorValue(color);
  }

  setTaskColor(taskId: string, color: TaskColor): void {
    this.tasks = this.tasks.map((task) => (task.id === taskId ? { ...task, color } : task));
    this.saveTasks();
  }

  toggleTask(taskId: string): void {
    const occurrenceDate = this.toDateKey(this.selectedDate);
    this.tasks = this.tasks.map((task) => {
      if (task.id !== taskId) {
        return task;
      }

      const completed = task.completedDates.includes(occurrenceDate);
      return {
        ...task,
        completedDates: completed
          ? task.completedDates.filter((date) => date !== occurrenceDate)
          : [...task.completedDates, occurrenceDate],
      };
    });
    this.saveTasks();
  }

  deleteTask(taskId: string): void {
    this.tasks = this.tasks.filter((task) => task.id !== taskId);
    this.saveTasks();
  }

  private createCalendarDay(date: Date): CalendarDay {
    const key = this.toDateKey(date);
    return {
      date,
      key,
      dayName: date.toLocaleDateString(undefined, { weekday: 'short' }),
      dayNumber: date.getDate(),
      isCurrentMonth: date.getMonth() === this.selectedDate.getMonth(),
      isToday: key === this.toDateKey(this.today),
      isSelected: key === this.toDateKey(this.selectedDate),
      taskCount: this.tasks.filter((task) => this.taskOccursOn(task, date)).length,
    };
  }

  private taskOccursOn(task: HabitTask, date: Date): boolean {
    const startDate = this.parseDateKey(task.date);
    if (date < startDate) {
      return false;
    }

    switch (task.repeat) {
      case 'daily':
        return true;
      case 'weekly':
        return date.getDay() === startDate.getDay();
      case 'monthly': {
        const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        return date.getDate() === Math.min(startDate.getDate(), lastDayOfMonth);
      }
      default:
        return task.date === this.toDateKey(date);
    }
  }

  private startOfWeek(date: Date): Date {
    const start = this.startOfDay(date);
    const daysFromMonday = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - daysFromMonday);
    return start;
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private addDays(date: Date, count: number): Date {
    const result = this.startOfDay(date);
    result.setDate(result.getDate() + count);
    return result;
  }

  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private parseDateKey(dateKey: string): Date {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private createTaskId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  private isValidTime(value: string): boolean {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  }

  private loadTasks(): HabitTask[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    try {
      const savedTasks = localStorage.getItem(this.storageKey);
      if (!savedTasks) {
        return [];
      }

      const parsed: unknown = JSON.parse(savedTasks);
      if (!Array.isArray(parsed)) {
        throw new Error('Saved tasks are not a list.');
      }

      return parsed.flatMap((task): HabitTask[] => {
        if (
          typeof task !== 'object' ||
          task === null ||
          !('id' in task) ||
          typeof task.id !== 'string' ||
          !('title' in task) ||
          typeof task.title !== 'string' ||
          !('date' in task) ||
          typeof task.date !== 'string'
        ) {
          return [];
        }

        return [
          {
            id: task.id,
            title: task.title,
            date: task.date,
            completedDates:
              'completedDates' in task && Array.isArray(task.completedDates)
                ? task.completedDates.filter(
                    (date: unknown): date is string => typeof date === 'string',
                  )
                : 'completed' in task && task.completed === true
                  ? [task.date]
                  : [],
            time: 'time' in task && typeof task.time === 'string' ? task.time : '',
            reminderTime:
              'reminderTime' in task && typeof task.reminderTime === 'string'
                ? task.reminderTime
                : 'reminder' in task && task.reminder === true
                  ? '09:00'
                  : '',
            sendNotification: 'sendNotification' in task && task.sendNotification === true,
            repeat:
              'repeat' in task &&
              (task.repeat === 'daily' || task.repeat === 'weekly' || task.repeat === 'monthly')
                ? task.repeat
                : ('none' as RepeatFrequency),
            color: 'color' in task && isTaskColor(task.color) ? task.color : 'sage',
          },
        ];
      });
    } catch (error) {
      this.storageError =
        error instanceof Error
          ? `Could not load saved tasks: ${error.message}`
          : 'Could not load saved tasks.';
      return [];
    }
  }

  private saveTasks(): void {
    this.reminderNotifications.sync(this.tasks);
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.tasks));
      this.storageError = '';
    } catch (error) {
      this.storageError =
        error instanceof Error
          ? `Could not save tasks: ${error.message}`
          : 'Could not save tasks.';
    }
  }
}
