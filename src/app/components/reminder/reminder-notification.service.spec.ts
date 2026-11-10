import { TestBed } from '@angular/core/testing';
import { HabitTask } from '../../models';
import { ReminderNotificationService } from './reminder-notification.service';

class FakeNotification {
  static permission: NotificationPermission = 'granted';
  static sent: Array<{ title: string; options: NotificationOptions }> = [];
  static requestPermission = vi.fn(async (): Promise<NotificationPermission> => 'granted');

  constructor(
    public readonly title: string,
    public readonly options: NotificationOptions = {},
  ) {
    FakeNotification.sent.push({ title, options });
  }
}

const makeTask = (overrides: Partial<HabitTask> = {}): HabitTask => ({
  id: 'task-1',
  title: 'Morning walk',
  date: '2026-11-09',
  completedDates: [],
  time: '',
  reminderTime: '08:30',
  sendNotification: true,
  repeat: 'none',
  color: 'sage',
  ...overrides,
});

describe('ReminderNotificationService', () => {
  beforeEach(() => {
    localStorage.clear();
    FakeNotification.permission = 'granted';
    FakeNotification.sent = [];
    FakeNotification.requestPermission.mockClear();
    vi.stubGlobal('Notification', FakeNotification);
    vi.stubGlobal('isSecureContext', true);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 9, 8, 29, 50));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('should deliver a due reminder and avoid showing it twice that day', async () => {
    await TestBed.configureTestingModule({
      providers: [ReminderNotificationService],
    }).compileComponents();
    const service = TestBed.inject(ReminderNotificationService);
    service.sync([makeTask()]);

    vi.setSystemTime(new Date(2026, 10, 9, 8, 30, 1));
    vi.advanceTimersByTime(10_000);
    service.sync([makeTask()]);

    expect(FakeNotification.sent).toEqual([
      {
        title: 'BrightSteps reminder',
        options: {
          body: 'Time for Morning walk',
          icon: '/brightsteps-icon.svg',
          tag: 'habit-reminder-task-1-2026-11-09',
        },
      },
    ]);
    expect(JSON.parse(localStorage.getItem('habit-tracker-notification-history') ?? '{}')).toEqual({
      'task-1': '2026-11-09',
    });
  });

  it('should request notification permission and report denied permission', async () => {
    await TestBed.configureTestingModule({
      providers: [ReminderNotificationService],
    }).compileComponents();
    const service = TestBed.inject(ReminderNotificationService);
    FakeNotification.permission = 'default';
    FakeNotification.requestPermission.mockResolvedValueOnce('denied');

    expect(await service.requestPermission()).toBe('denied');
    expect(FakeNotification.requestPermission).toHaveBeenCalledOnce();
    expect(service.errorMessage()).toContain('Notifications were blocked');
  });

  it('should schedule recurring tasks only on their matching dates', async () => {
    await TestBed.configureTestingModule({
      providers: [ReminderNotificationService],
    }).compileComponents();
    const service = TestBed.inject(ReminderNotificationService);
    service.sync([
      makeTask({ id: 'daily', repeat: 'daily' }),
      makeTask({ id: 'weekly', date: '2026-11-02', repeat: 'weekly' }),
      makeTask({ id: 'monthly', date: '2026-10-31', repeat: 'monthly' }),
    ]);

    vi.setSystemTime(new Date(2026, 10, 9, 8, 30, 1));
    vi.advanceTimersByTime(10_000);

    expect(FakeNotification.sent.map(({ options }) => options.tag)).toEqual([
      'habit-reminder-daily-2026-11-09',
      'habit-reminder-weekly-2026-11-09',
    ]);
  });
});
