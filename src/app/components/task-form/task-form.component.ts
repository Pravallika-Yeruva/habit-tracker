import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HabitTask, TASK_COLORS, TaskColor, TaskFormValue, taskColorValue } from '../../models';
import { ReminderComponent, ReminderSettings } from '../reminder/reminder.component';

type TaskTimeUnit = 'hour' | 'minute' | 'period';

const TASK_TIME_WHEEL_ITEM_WIDTH = 40;

@Component({
  imports: [FormsModule, ReminderComponent],
  selector: 'app-task-form',
  styleUrl: './task-form.component.scss',
  templateUrl: './task-form.component.html',
})
export class TaskFormComponent implements OnChanges {
  @Input() task: HabitTask | null = null;
  @Output() save = new EventEmitter<TaskFormValue>();
  @Output() cancel = new EventEmitter<void>();

  readonly taskColors = TASK_COLORS;
  taskDraft: TaskFormValue = this.emptyTask();
  newTaskHourDraft = '';
  newTaskMinuteDraft = '';
  newTaskPeriodDraft: 'AM' | 'PM' | '' = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['task']) {
      this.resetTaskDraft();
    }
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

  setReminder(settings: ReminderSettings): void {
    this.taskDraft.reminderTime = settings.time;
    this.taskDraft.sendNotification = settings.sendNotification;
  }

  colorValue(color: TaskColor): string {
    return taskColorValue(color);
  }

  submit(): void {
    const title = this.taskDraft.title.trim();
    if (!title) {
      return;
    }

    this.save.emit({ ...this.taskDraft, title });
  }

  private emptyTask(): TaskFormValue {
    return {
      title: '',
      time: '',
      reminderTime: '',
      sendNotification: false,
      repeat: 'none',
      color: 'sage',
    };
  }

  private resetTaskDraft(): void {
    const task = this.task;
    this.taskDraft = task
      ? {
          title: task.title,
          time: task.time,
          reminderTime: task.reminderTime,
          sendNotification: task.sendNotification,
          repeat: task.repeat,
          color: task.color,
        }
      : this.emptyTask();

    this.newTaskHourDraft = '';
    this.newTaskMinuteDraft = '';
    this.newTaskPeriodDraft = '';

    if (task?.time && this.isValidTime(task.time)) {
      const [hourText, minute] = task.time.split(':');
      const hour24 = Number(hourText);
      this.newTaskHourDraft = String(hour24 % 12 || 12).padStart(2, '0');
      this.newTaskMinuteDraft = minute;
      this.newTaskPeriodDraft = hour24 >= 12 ? 'PM' : 'AM';
    }
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

  private updateNewTaskTime(): void {
    if (!this.newTaskHourDraft || !this.newTaskMinuteDraft || !this.newTaskPeriodDraft) {
      this.taskDraft.time = '';
      return;
    }

    const hour12 = Number(this.newTaskHourDraft) % 12;
    const hour24 = hour12 + (this.newTaskPeriodDraft === 'PM' ? 12 : 0);
    this.taskDraft.time = `${String(hour24).padStart(2, '0')}:${this.newTaskMinuteDraft}`;
  }

  private isValidTime(value: string): boolean {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  }
}
