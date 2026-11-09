import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the habit tracker and open the reminder time modal from the reminder button', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.isAddingTask = true;
    fixture.componentInstance.openReminderTimeModal();
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('#tracker-title')?.textContent).toContain('Your habits, your rhythm.');
    expect(compiled.querySelector('[aria-label="Calendar view"]')).toBeTruthy();
    expect(compiled.querySelector('.week-strip')).toBeTruthy();
    expect(compiled.querySelector('.add-button')?.textContent).toContain('Add task');
    expect(compiled.querySelector('.reminder-settings')).toBeNull();
    expect(compiled.querySelector('[role="dialog"]')).toBeTruthy();
    const modalTimeInput = compiled.querySelector<HTMLInputElement>('input[name="reminderTimeDraft"]');
    expect(modalTimeInput).toBeNull();
    expect(compiled.querySelector<HTMLInputElement>('input[name="manualReminderTime"]')?.type).toBe('text');
    expect(compiled.querySelector('select[name="reminderHour"]')).toBeNull();
    expect(compiled.querySelector('select[name="reminderMinute"]')).toBeNull();
    expect(compiled.querySelector('select[name="reminderPeriod"]')).toBeTruthy();
    expect(compiled.querySelectorAll('.time-format-toggle button')).toHaveLength(2);
  });

  it('should add a task to the selected day', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.newTaskTitle = 'Read for 20 minutes';
    app.newTaskTime = '08:30';
    app.newTaskReminderTime = '08:00';
    app.newTaskSendNotification = true;
    app.newTaskRepeat = 'daily';
    app.newTaskColor = 'peach';
    app.addTask();

    expect(app.selectedTasks).toHaveLength(1);
    expect(app.selectedTasks[0].title).toBe('Read for 20 minutes');
    expect(app.selectedTasks[0].time).toBe('08:30');
    expect(app.selectedTasks[0].reminderTime).toBe('08:00');
    expect(app.selectedTasks[0].sendNotification).toBe(true);
    expect(app.selectedTasks[0].repeat).toBe('daily');
    expect(app.selectedTasks[0].color).toBe('peach');
    expect(app.newTaskReminderTime).toBe('');
    expect(app.newTaskSendNotification).toBe(false);
    expect(app.newTaskTime).toBe('');
    expect(app.newTaskRepeat).toBe('none');
    expect(app.newTaskColor).toBe('sage');
  });

  it('should edit an existing task without duplicating it or clearing completion', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.newTaskTitle = 'Morning walk';
    app.newTaskTime = '08:30';
    app.newTaskReminderTime = '08:00';
    app.newTaskSendNotification = true;
    app.newTaskRepeat = 'daily';
    app.newTaskColor = 'sage';
    app.addTask();

    const taskId = app.selectedTasks[0].id;
    app.toggleTask(taskId);
    app.editTask(taskId);

    expect(app.isAddingTask).toBe(true);
    expect(app.editingTaskId).toBe(taskId);
    expect(app.newTaskTitle).toBe('Morning walk');
    expect(app.newTaskTime).toBe('08:30');
    expect(app.newTaskHourDraft).toBe('08');
    expect(app.newTaskMinuteDraft).toBe('30');
    expect(app.newTaskPeriodDraft).toBe('AM');
    expect(app.newTaskReminderTime).toBe('08:00');
    expect(app.newTaskSendNotification).toBe(true);
    expect(app.newTaskRepeat).toBe('daily');

    app.newTaskTitle = 'Evening walk';
    app.newTaskHourDraft = '06';
    app.newTaskMinuteDraft = '45';
    app.newTaskPeriodDraft = 'PM';
    app.updateNewTaskTime();
    app.newTaskReminderTime = '18:30';
    app.newTaskSendNotification = false;
    app.newTaskRepeat = 'weekly';
    app.newTaskColor = 'lavender';
    app.addTask();

    expect(app.selectedTasks).toHaveLength(1);
    expect(app.selectedTasks[0]).toMatchObject({
      id: taskId,
      title: 'Evening walk',
      time: '18:45',
      reminderTime: '18:30',
      sendNotification: false,
      repeat: 'weekly',
      color: 'lavender',
      completed: true,
    });
    expect(JSON.parse(localStorage.getItem('habit-tracker-tasks') ?? '[]')).toHaveLength(1);
  });

  it('should build a task time from scrollable hour, minute, and AM/PM choices', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    expect(app.taskTimeHours).toHaveLength(12);
    expect(app.taskTimeMinutes).toHaveLength(60);
    expect(app.newTaskTime).toBe('');
    app.newTaskHourDraft = '08';
    app.updateNewTaskTime();
    expect(app.newTaskTime).toBe('');

    app.newTaskMinuteDraft = '35';
    app.updateNewTaskTime();
    expect(app.newTaskTime).toBe('');

    app.newTaskPeriodDraft = 'PM';
    app.updateNewTaskTime();
    expect(app.newTaskTime).toBe('20:35');

    app.newTaskTitle = 'Morning walk';
    app.addTask();
    expect(app.selectedTasks[0].time).toBe('20:35');
    expect(app.newTaskHourDraft).toBe('');
    expect(app.newTaskMinuteDraft).toBe('');
    expect(app.newTaskPeriodDraft).toBe('');

    app.newTaskHourDraft = '12';
    app.newTaskMinuteDraft = '00';
    app.newTaskPeriodDraft = 'AM';
    app.updateNewTaskTime();
    expect(app.newTaskTime).toBe('00:00');
    app.newTaskPeriodDraft = 'PM';
    app.updateNewTaskTime();
    expect(app.newTaskTime).toBe('12:00');
  });

  it('should update task time as the wheel columns scroll', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.isAddingTask = true;
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const hourWheel = root.querySelector<HTMLElement>('[aria-label="Task hour"].task-time-wheel');
    const minuteWheel = root.querySelector<HTMLElement>(
      '[aria-label="Task minute"].task-time-wheel',
    );
    const periodWheel = root.querySelector<HTMLElement>('[aria-label="AM or PM"].task-time-wheel');
    expect(hourWheel).toBeTruthy();
    expect(minuteWheel).toBeTruthy();
    expect(periodWheel).toBeTruthy();
    expect(hourWheel?.querySelectorAll('[role="option"]')).toHaveLength(13);

    if (hourWheel) {
      hourWheel.scrollLeft = 8 * 40;
    }
    hourWheel?.dispatchEvent(new Event('scroll'));
    if (minuteWheel) {
      minuteWheel.scrollLeft = 40;
    }
    minuteWheel?.dispatchEvent(new Event('scroll'));
    if (periodWheel) {
      periodWheel.scrollLeft = 80;
    }
    periodWheel?.dispatchEvent(new Event('scroll'));

    expect(app.newTaskTime).toBe('20:00');
  });

  it('should only save a reminder after confirming its time', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    expect(app.hasNewTaskReminder).toBe(false);
    app.openReminderTimeModal();
    expect(app.isReminderTimeModalOpen).toBe(true);
    expect(app.hasNewTaskReminder).toBe(false);
    expect(app.reminderTimeDraft).toBe('09:00');

    app.selectReminderTime('14:15');
    app.applyReminderTime();
    expect(app.newTaskReminderTime).toBe('14:15');
    expect(app.hasNewTaskReminder).toBe(true);

    app.openReminderTimeModal();
    app.removeNewTaskReminder();
    expect(app.hasNewTaskReminder).toBe(false);
  });

  it('should allow selecting a suggested reminder time', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.openReminderTimeModal();
    app.selectReminderTime('18:00');
    app.applyReminderTime();

    expect(app.newTaskReminderTime).toBe('18:00');
    expect(app.reminderPresets.map((preset) => preset.time)).toContain('18:00');
  });

  it('should open a time picker modal and apply its selected time', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.openReminderTimeModal();

    expect(app.isReminderTimeModalOpen).toBe(true);
    expect(app.reminderTimeDraft).toBe('09:00');

    app.setReminderTimeFormat('24-hour');
    app.updateReminderTimeFromManualEntry('16:45');
    app.applyReminderTime();

    expect(app.newTaskReminderTime).toBe('16:45');
    expect(app.isReminderTimeModalOpen).toBe(false);
  });

  it('should support manual entry in 12-hour and 24-hour formats', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.openReminderTimeModal();

    app.updateReminderTimeFromManualEntry('4:05');
    expect(app.reminderTimeDraft).toBe('04:05');
    expect(app.reminderTimePreview).toBe('04:05 AM');

    app.updateReminderPeriod('PM');
    expect(app.reminderTimeDraft).toBe('16:05');
    expect(app.reminderPeriodDraft).toBe('PM');
    expect(app.reminderTimePreview).toBe('04:05 PM');

    app.setReminderTimeFormat('24-hour');
    expect(app.manualReminderTimeDraft).toBe('16:05');
    expect(app.reminderTimePreview).toBe('16:05');
    app.updateReminderTimeFromManualEntry('08:05');
    expect(app.reminderPeriodDraft).toBe('AM');
    expect(app.reminderTimePreview).toBe('08:05');

    app.updateReminderTimeFromManualEntry('00:30');
    expect(app.reminderTimePreview).toBe('00:30');
    app.updateReminderTimeFromManualEntry('12:30');
    expect(app.reminderTimePreview).toBe('12:30');

    app.updateReminderTimeFromManualEntry('24:30');
    expect(app.isValidManualReminderTime).toBe(false);
    expect(app.reminderTimePreview).toBe('--:--');

    app.setReminderTimeFormat('12-hour');
    expect(app.manualReminderTimeDraft).toBe('12:30');
    expect(app.reminderTimePreview).toBe('12:30 PM');
  });

  it('should change the color of an existing task', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.newTaskTitle = 'Go for a walk';
    app.addTask();
    const task = app.selectedTasks[0];

    app.setTaskColor(task.id, 'lavender');

    expect(app.selectedTasks[0].color).toBe('lavender');
  });

  it('should switch between day, week, and month calendar views', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.setView('day');
    expect(app.view).toBe('day');
    app.setView('month');
    expect(app.view).toBe('month');
    expect(app.monthDays).toHaveLength(42);
  });

  it('should show weekly recurring tasks on the same weekday and track completion per date', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.selectDate(new Date(2026, 0, 5));
    app.newTaskTitle = 'Weekly planning';
    app.newTaskRepeat = 'weekly';
    app.addTask();

    app.toggleTask(app.selectedTasks[0].id);
    expect(app.selectedTasks[0].completed).toBe(true);

    app.selectDate(new Date(2026, 0, 12));
    expect(app.selectedTasks).toHaveLength(1);
    expect(app.selectedTasks[0].completed).toBe(false);
  });

  it('should repeat monthly tasks at month end when the original date does not exist', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.selectDate(new Date(2026, 0, 31));
    app.newTaskTitle = 'Monthly review';
    app.newTaskRepeat = 'monthly';
    app.addTask();

    app.selectDate(new Date(2026, 1, 28));

    expect(app.selectedTasks).toHaveLength(1);
    expect(app.selectedTasks[0].title).toBe('Monthly review');
  });
});
