import { DestroyRef, Injectable, signal } from '@angular/core';
import { HabitTask } from '../../models';

const NOTIFICATION_HISTORY_KEY = 'habit-tracker-notification-history';
const REMINDER_CHECK_INTERVAL_MS = 10_000;

@Injectable({ providedIn: 'root' })
export class ReminderNotificationService {
  readonly errorMessage = signal('');

  private tasks: readonly HabitTask[] = [];
  private readonly notifiedDates = this.loadNotificationHistory();
  private readonly intervalId: ReturnType<typeof setInterval>;

  constructor(destroyRef: DestroyRef) {
    this.intervalId = setInterval(() => this.checkReminders(), REMINDER_CHECK_INTERVAL_MS);
    destroyRef.onDestroy(() => clearInterval(this.intervalId));
  }

  async requestPermission(): Promise<NotificationPermission | null> {
    if (typeof Notification === 'undefined') {
      this.errorMessage.set('This browser does not support desktop notifications.');
      return null;
    }

    if (!globalThis.isSecureContext) {
      this.errorMessage.set('Notifications require a secure connection (HTTPS or localhost).');
      return null;
    }

    if (Notification.permission === 'granted') {
      this.errorMessage.set('');
      return 'granted';
    }

    if (Notification.permission === 'denied') {
      this.errorMessage.set(
        'Notifications are blocked for this site. Allow them in your browser settings to continue.',
      );
      return 'denied';
    }

    try {
      const permission = await Notification.requestPermission();
      this.errorMessage.set(
        permission === 'denied'
          ? 'Notifications were blocked. Allow them in your browser settings to continue.'
          : '',
      );
      if (permission === 'granted') {
        this.checkReminders();
      }
      return permission;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'The notification permission request failed.';
      this.errorMessage.set(`Could not request notification permission: ${message}`);
      return null;
    }
  }

  sync(tasks: readonly HabitTask[]): void {
    this.tasks = tasks;
    this.checkReminders();
  }

  private checkReminders(): void {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      return;
    }

    const now = new Date();
    const dateKey = this.toDateKey(now);
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const dueTasks = this.tasks.filter(
      (task) =>
        task.sendNotification &&
        task.reminderTime === time &&
        this.taskOccursOn(task, now) &&
        this.notifiedDates[task.id] !== dateKey,
    );

    for (const task of dueTasks) {
      try {
        new Notification('BrightSteps reminder', {
          body: `Time for ${task.title}`,
          icon: '/brightsteps-icon.svg',
          tag: `habit-reminder-${task.id}-${dateKey}`,
        });
        this.notifiedDates[task.id] = dateKey;
        this.saveNotificationHistory();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'The browser could not display the notification.';
        this.errorMessage.set(`Could not show a reminder notification: ${message}`);
      }
    }
  }

  private taskOccursOn(task: HabitTask, date: Date): boolean {
    const dateKey = this.toDateKey(date);
    if (dateKey < task.date) {
      return false;
    }

    switch (task.repeat) {
      case 'daily':
        return true;
      case 'weekly': {
        const [year, month, day] = task.date.split('-').map(Number);
        return date.getDay() === new Date(year, month - 1, day).getDay();
      }
      case 'monthly': {
        const [, , day] = task.date.split('-').map(Number);
        const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        return date.getDate() === Math.min(day, lastDayOfMonth);
      }
      default:
        return task.date === dateKey;
    }
  }

  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private loadNotificationHistory(): Record<string, string> {
    if (typeof localStorage === 'undefined') {
      return {};
    }

    try {
      const savedHistory = localStorage.getItem(NOTIFICATION_HISTORY_KEY);
      if (!savedHistory) {
        return {};
      }

      const parsed: unknown = JSON.parse(savedHistory);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Saved notification history is not an object.');
      }

      return Object.fromEntries(
        Object.entries(parsed).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Saved notification history could not be read.';
      this.errorMessage.set(`Could not load notification history: ${message}`);
      return {};
    }
  }

  private saveNotificationHistory(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(this.notifiedDates));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Notification history could not be saved.';
      this.errorMessage.set(`Could not save notification history: ${message}`);
    }
  }
}
