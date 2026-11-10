import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HabitTask, TASK_COLORS, TaskColor, TaskFormValue, taskColorValue } from '../../models';
import { ReminderComponent, ReminderSettings } from '../reminder/reminder.component';

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

  readonly quickTasks = ['Gym', 'Walking', 'Running', 'Chores', 'Reading', 'Meditation'];
  readonly taskColors = TASK_COLORS;
  taskDraft: TaskFormValue = this.emptyTask();
  taskTimeInput = '';

  get isTaskTimeValid(): boolean {
    return this.taskTimeInput === '' || this.parseTaskTime(this.taskTimeInput) !== null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['task']) {
      this.resetTaskDraft();
    }
  }

  setReminder(settings: ReminderSettings): void {
    this.taskDraft.reminderTime = settings.time;
    this.taskDraft.sendNotification = settings.sendNotification;
  }

  chooseQuickTask(title: string): void {
    this.taskDraft.title = title;
  }

  updateTaskTime(event: Event): void {
    const value = (event.currentTarget as HTMLInputElement).value;
    this.taskTimeInput = value;
    this.taskDraft.time = this.parseTaskTime(value) ?? '';
  }

  colorValue(color: TaskColor): string {
    return taskColorValue(color);
  }

  submit(): void {
    const title = this.taskDraft.title.trim();
    if (!title || !this.isTaskTimeValid) {
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
    this.taskTimeInput = task?.time ? this.formatTaskTime(task.time) : '';
  }

  private parseTaskTime(value: string): string | null {
    const match = /^(0?[1-9]|1[0-2]):([0-5]\d)\s?(AM|PM)$/i.exec(value.trim());
    if (!match) {
      return null;
    }

    const hour12 = Number(match[1]) % 12;
    const hour24 = hour12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
    return `${String(hour24).padStart(2, '0')}:${match[2]}`;
  }

  private formatTaskTime(value: string): string {
    const [hourText, minute] = value.split(':');
    const hour24 = Number(hourText);
    const hour12 = hour24 % 12 || 12;
    return `${String(hour12).padStart(2, '0')}:${minute} ${hour24 >= 12 ? 'PM' : 'AM'}`;
  }
}
