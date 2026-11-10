import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ReminderNotificationService } from './reminder-notification.service';

type ReminderTimeFormat = '12-hour' | '24-hour';

interface ReminderPreset {
  label: string;
  time: string;
}

export interface ReminderSettings {
  time: string;
  sendNotification: boolean;
}

const REMINDER_PRESETS: ReminderPreset[] = [
  { label: 'Morning', time: '08:00' },
  { label: 'Midday', time: '12:00' },
  { label: 'Evening', time: '18:00' },
];

@Component({
  imports: [FormsModule],
  selector: 'app-reminder',
  styleUrl: './reminder.component.scss',
  templateUrl: './reminder.component.html',
})
export class ReminderComponent {
  @Input() reminderTime = '';
  @Input() sendNotification = false;
  @Output() reminderChange = new EventEmitter<ReminderSettings>();

  readonly reminderPresets = REMINDER_PRESETS;
  reminderTimeDraft = '';
  reminderTimeFormatDraft: ReminderTimeFormat = '12-hour';
  reminderPeriodDraft: 'AM' | 'PM' = 'AM';
  manualReminderTimeDraft = '09:00';
  reminderNotificationDraft = false;
  isReminderTimeModalOpen = false;
  notificationPermissionMessage = '';

  constructor(private readonly notifications: ReminderNotificationService) {}

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

  openReminderTimeModal(): void {
    this.setReminderDraft(this.reminderTime || '09:00');
    this.reminderNotificationDraft = this.sendNotification;
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

    this.reminderChange.emit({
      time: this.reminderTimeDraft,
      sendNotification: this.reminderNotificationDraft,
    });
    this.closeReminderTimeModal();
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

  async updateNotificationPreference(enabled: boolean): Promise<void> {
    this.reminderNotificationDraft = enabled;
    this.notificationPermissionMessage = '';
    if (!enabled) {
      return;
    }

    const permission = await this.notifications.requestPermission();
    if (permission !== 'granted') {
      this.reminderNotificationDraft = false;
      this.notificationPermissionMessage =
        this.notifications.errorMessage() || 'Notification permission is required.';
    }
  }

  removeNewTaskReminder(): void {
    this.reminderChange.emit({ time: '', sendNotification: false });
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
}
