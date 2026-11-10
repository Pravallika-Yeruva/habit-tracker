import { TestBed } from '@angular/core/testing';
import { ReminderComponent } from './reminder.component';

describe('ReminderComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReminderComponent],
    }).compileComponents();
  });

  it('should open the dialog and emit a selected reminder time', () => {
    const fixture = TestBed.createComponent(ReminderComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.openReminderTimeModal();
    expect(component.isReminderTimeModalOpen).toBe(true);

    const changes: Array<{ time: string; sendNotification: boolean }> = [];
    component.reminderChange.subscribe((settings) => changes.push(settings));
    component.selectReminderTime('18:00');
    component.reminderNotificationDraft = true;
    component.applyReminderTime();

    expect(changes).toEqual([{ time: '18:00', sendNotification: true }]);
    expect(component.isReminderTimeModalOpen).toBe(false);
  });

  it('should validate manual time in 12-hour and 24-hour formats', () => {
    const fixture = TestBed.createComponent(ReminderComponent);
    const component = fixture.componentInstance;
    component.openReminderTimeModal();
    component.updateReminderTimeFromManualEntry('4:05');
    expect(component.reminderTimePreview).toBe('04:05 AM');

    component.updateReminderPeriod('PM');
    expect(component.reminderTimePreview).toBe('04:05 PM');
    component.setReminderTimeFormat('24-hour');
    component.updateReminderTimeFromManualEntry('24:30');
    expect(component.isValidManualReminderTime).toBe(false);
    expect(component.reminderTimePreview).toBe('--:--');
  });

  it('should emit cleared reminder settings when removing an existing reminder', () => {
    const fixture = TestBed.createComponent(ReminderComponent);
    fixture.componentRef.setInput('reminderTime', '08:00');
    fixture.detectChanges();
    const component = fixture.componentInstance;

    const changes: Array<{ time: string; sendNotification: boolean }> = [];
    component.reminderChange.subscribe((settings) => changes.push(settings));
    component.openReminderTimeModal();
    component.removeNewTaskReminder();

    expect(changes).toEqual([{ time: '', sendNotification: false }]);
    expect(component.isReminderTimeModalOpen).toBe(false);
  });

  it('should keep notifications disabled when browser permission is denied', async () => {
    class DeniedNotification {
      static permission: NotificationPermission = 'default';
      static requestPermission = vi.fn(async (): Promise<NotificationPermission> => 'denied');
    }

    vi.stubGlobal('Notification', DeniedNotification);
    vi.stubGlobal('isSecureContext', true);
    const fixture = TestBed.createComponent(ReminderComponent);
    const component = fixture.componentInstance;

    await component.updateNotificationPreference(true);

    expect(component.reminderNotificationDraft).toBe(false);
    expect(component.notificationPermissionMessage).toContain('Notifications were blocked');
  });
});
