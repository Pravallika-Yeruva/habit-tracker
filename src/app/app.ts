import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

type CalendarView = 'day' | 'week' | 'month';
type TaskColor = 'sage' | 'peach' | 'blue' | 'lavender' | 'yellow';
type RepeatFrequency = 'none' | 'daily' | 'weekly' | 'monthly';
type ReminderTimeFormat = '12-hour' | '24-hour';
type TaskTimeUnit = 'hour' | 'minute' | 'period';

const TASK_COLORS: TaskColor[] = ['sage', 'peach', 'blue', 'lavender', 'yellow'];
const TASK_TIME_WHEEL_ITEM_WIDTH = 40;
const REMINDER_PRESETS = [
  { label: 'Morning', time: '08:00' },
  { label: 'Midday', time: '12:00' },
  { label: 'Evening', time: '18:00' },
] as const;

function isTaskColor(value: unknown): value is TaskColor {
  return TASK_COLORS.some((color) => color === value);
}

interface HabitTask {
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

interface TaskOccurrence extends HabitTask {
  completed: boolean;
}

interface CalendarDay {
  date: Date;
  key: string;
  dayName: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  taskCount: number;
}

@Component({
  imports: [FormsModule],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly storageKey = 'habit-tracker-tasks';
  private readonly today = this.startOfDay(new Date());

  selectedDate = new Date(this.today);
  view: CalendarView = 'week';
  storageError = '';
  tasks: HabitTask[] = this.loadTasks();
  isAddingTask = false;
  editingTaskId: string | null = null;
  newTaskTitle = '';
  newTaskTime = '';
  newTaskHourDraft = '';
  newTaskMinuteDraft = '';
  newTaskPeriodDraft: 'AM' | 'PM' | '' = '';
  newTaskReminderTime = '';
  reminderTimeDraft = '';
  reminderTimeFormatDraft: ReminderTimeFormat = '12-hour';
  reminderPeriodDraft: 'AM' | 'PM' = 'AM';
  manualReminderTimeDraft = '09:00';
  reminderNotificationDraft = false;
  isReminderTimeModalOpen = false;
  newTaskSendNotification = false;
  newTaskRepeat: RepeatFrequency = 'none';
  newTaskColor: TaskColor = 'sage';

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

  get taskTimeHours(): string[] {
    return Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
  }

  get taskTimeMinutes(): string[] {
    return Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, '0'));
  }

  get taskTimePeriods(): string[] {
    return ['AM', 'PM'];
  }

  taskTimeWheelOptions(unit: TaskTimeUnit): string[] {
    const values =
      unit === 'hour'
        ? this.taskTimeHours
        : unit === 'minute'
          ? this.taskTimeMinutes
          : this.taskTimePeriods;
    return ['', ...values];
  }

  taskTimeWheelOffset(unit: TaskTimeUnit): number {
    const index = this.taskTimeWheelOptions(unit).indexOf(this.taskTimeValue(unit));
    return Math.max(index, 0) * TASK_TIME_WHEEL_ITEM_WIDTH;
  }

  onTaskTimeWheelScroll(event: Event, unit: TaskTimeUnit): void {
    const wheel = event.currentTarget as HTMLElement;
    const optionIndex = Math.round(wheel.scrollLeft / TASK_TIME_WHEEL_ITEM_WIDTH);
    const options = this.taskTimeWheelOptions(unit);
    this.setTaskTimeOption(unit, options[Math.min(optionIndex, options.length - 1)] ?? '');
  }

  onTaskTimeWheelKeydown(event: KeyboardEvent, unit: TaskTimeUnit): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }

    event.preventDefault();
    const options = this.taskTimeWheelOptions(unit);
    const selected = this.taskTimeValue(unit);
    const currentIndex = Math.max(options.indexOf(selected), 0);
    const increment = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = Math.max(0, Math.min(options.length - 1, currentIndex + increment));
    this.setTaskTimeOption(unit, options[nextIndex]);
    (event.currentTarget as HTMLElement).scrollTo({
      left: nextIndex * TASK_TIME_WHEEL_ITEM_WIDTH,
      behavior: 'smooth',
    });
  }

  selectTaskTimeOption(event: MouseEvent, unit: TaskTimeUnit, value: string): void {
    this.setTaskTimeOption(unit, value);
    const wheel = (event.currentTarget as HTMLElement).closest('.task-time-wheel');
    const index = this.taskTimeWheelOptions(unit).indexOf(value);
    wheel?.scrollTo({ left: index * TASK_TIME_WHEEL_ITEM_WIDTH, behavior: 'smooth' });
  }

  updateNewTaskTime(): void {
    if (!this.newTaskHourDraft || !this.newTaskMinuteDraft || !this.newTaskPeriodDraft) {
      this.newTaskTime = '';
      return;
    }

    const hour12 = Number(this.newTaskHourDraft) % 12;
    const hour24 = hour12 + (this.newTaskPeriodDraft === 'PM' ? 12 : 0);
    this.newTaskTime = `${String(hour24).padStart(2, '0')}:${this.newTaskMinuteDraft}`;
  }

  private setTaskTimeOption(unit: TaskTimeUnit, value: string): void {
    if (unit === 'hour') {
      this.newTaskHourDraft = value;
    } else if (unit === 'minute') {
      this.newTaskMinuteDraft = value;
    } else {
      this.newTaskPeriodDraft = value === 'AM' || value === 'PM' ? value : '';
    }

    this.updateNewTaskTime();
  }

  private taskTimeValue(unit: TaskTimeUnit): string {
    if (unit === 'hour') {
      return this.newTaskHourDraft;
    }
    if (unit === 'minute') {
      return this.newTaskMinuteDraft;
    }
    return this.newTaskPeriodDraft;
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

    this.selectedDate = this.addDays(this.selectedDate, this.view === 'week' ? direction * 7 : direction);
  }

  goToToday(): void {
    this.selectedDate = new Date(this.today);
  }

  toggleTaskForm(): void {
    if (this.isAddingTask) {
      this.cancelTaskForm();
      return;
    }

    this.resetTaskForm();
    this.isAddingTask = true;
  }

  editTask(taskId: string): void {
    const task = this.tasks.find((candidate) => candidate.id === taskId);
    if (!task) {
      return;
    }

    this.resetTaskForm();
    this.editingTaskId = task.id;
    this.newTaskTitle = task.title;
    this.newTaskTime = task.time;
    if (task.time && this.isValidTime(task.time)) {
      const [hourText, minute] = task.time.split(':');
      const hour24 = Number(hourText);
      this.newTaskHourDraft = String(hour24 % 12 || 12).padStart(2, '0');
      this.newTaskMinuteDraft = minute;
      this.newTaskPeriodDraft = hour24 >= 12 ? 'PM' : 'AM';
    }
    this.newTaskReminderTime = task.reminderTime;
    this.newTaskSendNotification = task.sendNotification;
    this.newTaskRepeat = task.repeat;
    this.newTaskColor = task.color;
    this.isAddingTask = true;
  }

  cancelTaskForm(): void {
    this.resetTaskForm();
    this.isAddingTask = false;
  }

  addTask(): void {
    const title = this.newTaskTitle.trim();
    if (!title || (this.hasNewTaskReminder && !this.isValidTime(this.newTaskReminderTime))) {
      return;
    }

    if (this.editingTaskId) {
      const taskId = this.editingTaskId;
      this.tasks = this.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              title,
              time: this.newTaskTime,
              reminderTime: this.newTaskReminderTime,
              sendNotification: this.newTaskSendNotification,
              repeat: this.newTaskRepeat,
              color: this.newTaskColor,
            }
          : task,
      );
      this.resetTaskForm();
      this.isAddingTask = false;
      this.saveTasks();
      return;
    }

    this.tasks = [
      ...this.tasks,
      {
        id: this.createTaskId(),
        title,
        date: this.toDateKey(this.selectedDate),
        completedDates: [],
        time: this.newTaskTime,
        reminderTime: this.newTaskReminderTime,
        sendNotification: this.newTaskSendNotification,
        repeat: this.newTaskRepeat,
        color: this.newTaskColor,
      },
    ];
    this.resetTaskForm();
    this.isAddingTask = false;
    this.saveTasks();
  }

  private resetTaskForm(): void {
    this.newTaskTitle = '';
    this.newTaskTime = '';
    this.newTaskHourDraft = '';
    this.newTaskMinuteDraft = '';
    this.newTaskPeriodDraft = '';
    this.newTaskReminderTime = '';
    this.reminderTimeDraft = '';
    this.isReminderTimeModalOpen = false;
    this.newTaskSendNotification = false;
    this.newTaskRepeat = 'none';
    this.newTaskColor = 'sage';
    this.editingTaskId = null;
    this.isReminderTimeModalOpen = false;
  }

  get taskColors(): TaskColor[] {
    return TASK_COLORS;
  }

  get reminderPresets(): typeof REMINDER_PRESETS {
    return REMINDER_PRESETS;
  }

  get reminderTimePreview(): string {
    if (!this.isValidManualReminderTime) {
      return '--:--';
    }

    return this.reminderTimeFormatDraft === '24-hour'
      ? this.reminderTimeDraft
      : `${this.formatTimeFor12Hour(this.reminderTimeDraft)} ${this.reminderPeriodDraft}`;
  }

  get isValidManualReminderTime(): boolean {
    return this.reminderTimeFormatDraft === '24-hour'
      ? /^(0?\d|1\d|2[0-3]):[0-5]\d$/.test(this.manualReminderTimeDraft)
      : /^(0?[1-9]|1[0-2]):[0-5]\d$/.test(this.manualReminderTimeDraft);
  }

  get hasNewTaskReminder(): boolean {
    return this.newTaskReminderTime !== '';
  }

  openReminderTimeModal(): void {
    this.setReminderDraft(this.newTaskReminderTime || '09:00');
    this.reminderNotificationDraft = this.newTaskSendNotification;
    this.isReminderTimeModalOpen = true;
  }

  closeReminderTimeModal(): void {
    this.isReminderTimeModalOpen = false;
    this.reminderTimeDraft = '';
    this.manualReminderTimeDraft = '';
    this.reminderNotificationDraft = false;
  }

  applyReminderTime(): void {
    if (!this.isValidTime(this.reminderTimeDraft) || !this.isValidManualReminderTime) {
      return;
    }

    this.newTaskReminderTime = this.reminderTimeDraft;
    this.newTaskSendNotification = this.reminderNotificationDraft;
    this.isReminderTimeModalOpen = false;
    this.reminderTimeDraft = '';
    this.manualReminderTimeDraft = '';
    this.reminderNotificationDraft = false;
  }

  selectReminderTime(time: string): void {
    if (this.isValidTime(time)) {
      this.setReminderDraft(time);
    }
  }

  setReminderTimeFormat(format: ReminderTimeFormat): void {
    if (format === this.reminderTimeFormatDraft) {
      return;
    }

    this.reminderTimeFormatDraft = format;
    this.setReminderDraft(this.reminderTimeDraft || '09:00');
    this.manualReminderTimeDraft =
      format === '24-hour'
        ? this.reminderTimeDraft
        : this.formatTimeFor12Hour(this.reminderTimeDraft);
  }

  updateReminderTimeFromManualEntry(value: string): void {
    this.manualReminderTimeDraft = value;
    const pattern =
      this.reminderTimeFormatDraft === '24-hour'
        ? /^(0?\d|1\d|2[0-3]):([0-5]\d)$/
        : /^(0?[1-9]|1[0-2]):([0-5]\d)$/;
    const match = pattern.exec(value);
    if (!match) {
      return;
    }

    let hour24 = Number(match[1]);
    if (this.reminderTimeFormatDraft === '12-hour') {
      hour24 = (hour24 % 12) + (this.reminderPeriodDraft === 'PM' ? 12 : 0);
    } else {
      this.reminderPeriodDraft = hour24 >= 12 ? 'PM' : 'AM';
    }
    this.reminderTimeDraft = `${String(hour24).padStart(2, '0')}:${match[2]}`;
  }

  updateReminderPeriod(period: 'AM' | 'PM'): void {
    this.reminderPeriodDraft = period;
    this.updateReminderTimeFromManualEntry(this.manualReminderTimeDraft);
  }

  removeNewTaskReminder(): void {
    this.newTaskReminderTime = '';
    this.newTaskSendNotification = false;
    this.closeReminderTimeModal();
  }

  isValidTime(value: string): boolean {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  }

  private setReminderDraft(time: string): void {
    this.reminderTimeDraft = time;
    const [hourText] = time.split(':');
    const hour24 = Number(hourText);
    this.reminderPeriodDraft = hour24 >= 12 ? 'PM' : 'AM';
    this.manualReminderTimeDraft =
      this.reminderTimeFormatDraft === '24-hour'
        ? time
        : this.formatTimeFor12Hour(time);
  }

  private formatTimeFor12Hour(time: string): string {
    const [hourText, minute] = time.split(':');
    return `${String(Number(hourText) % 12 || 12).padStart(2, '0')}:${minute}`;
  }

  setNewTaskColor(color: TaskColor): void {
    this.newTaskColor = color;
  }

  setTaskColor(taskId: string, color: TaskColor): void {
    this.tasks = this.tasks.map((task) => (task.id === taskId ? { ...task, color } : task));
    this.saveTasks();
  }

  colorValue(color: TaskColor): string {
    const colors: Record<TaskColor, string> = {
      sage: '#78927f',
      peach: '#d98567',
      blue: '#7196b4',
      lavender: '#9a86b5',
      yellow: '#c4a34e',
    };
    return colors[color];
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
                  ? task.completedDates.filter((date: unknown): date is string => typeof date === 'string')
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
              sendNotification:
                'sendNotification' in task && task.sendNotification === true,
              repeat:
                'repeat' in task &&
                (task.repeat === 'daily' || task.repeat === 'weekly' || task.repeat === 'monthly')
                  ? task.repeat
                  : 'none',
              color: 'color' in task && isTaskColor(task.color) ? task.color : 'sage',
          },
        ];
      });
    } catch (error) {
      this.storageError =
        error instanceof Error ? `Could not load saved tasks: ${error.message}` : 'Could not load saved tasks.';
      return [];
    }
  }

  private saveTasks(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.tasks));
      this.storageError = '';
    } catch (error) {
      this.storageError =
        error instanceof Error ? `Could not save tasks: ${error.message}` : 'Could not save tasks.';
    }
  }
}
