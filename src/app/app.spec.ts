import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { ReminderComponent } from './components/reminder/reminder.component';
import { TaskFormComponent } from './components/task-form/task-form.component';
import { RepeatFrequency, TaskColor, TaskFormValue } from './models';

const taskDraft = (overrides: Partial<TaskFormValue> = {}): TaskFormValue => ({
  title: 'Morning walk',
  time: '',
  reminderTime: '',
  sendNotification: false,
  repeat: 'none',
  color: 'sage',
  ...overrides,
});

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should render the tracker with separate days, task, and reminder components', () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.isAddingTask = true;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('#tracker-title')?.textContent).toContain(
      'Your habits, your rhythm.',
    );
    expect(compiled.querySelector('[aria-label="Calendar view"]')).toBeTruthy();
    expect(compiled.querySelector('app-days .week-strip')).toBeTruthy();
    expect(compiled.querySelector('app-task-form .add-task-form')).toBeTruthy();
    expect(compiled.querySelector('app-reminder .reminder-button')).toBeTruthy();
  });

  it('should add a task from the task form and save it for the selected day', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.isAddingTask = true;
    fixture.detectChanges();

    const form = fixture.debugElement.query(By.directive(TaskFormComponent))
      .componentInstance as TaskFormComponent;
    form.taskDraft = taskDraft({
      title: 'Read for 20 minutes',
      time: '08:30',
      reminderTime: '08:00',
      sendNotification: true,
      repeat: 'daily',
      color: 'peach',
    });
    form.save.emit(form.taskDraft);

    expect(app.selectedTasks).toHaveLength(1);
    expect(app.selectedTasks[0]).toMatchObject({
      title: 'Read for 20 minutes',
      time: '08:30',
      reminderTime: '08:00',
      sendNotification: true,
      repeat: 'daily' satisfies RepeatFrequency,
      color: 'peach' satisfies TaskColor,
    });
    expect(app.isAddingTask).toBe(false);
    expect(JSON.parse(localStorage.getItem('habit-tracker-tasks') ?? '[]')).toHaveLength(1);
  });

  it('should edit a task without duplicating it or clearing completion', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.addTask(taskDraft({ time: '08:30', repeat: 'daily' }));
    const taskId = app.selectedTasks[0].id;
    app.toggleTask(taskId);
    app.editTask(taskId);
    fixture.detectChanges();

    const form = fixture.debugElement.query(By.directive(TaskFormComponent))
      .componentInstance as TaskFormComponent;
    expect(form.taskDraft).toMatchObject({
      title: 'Morning walk',
      time: '08:30',
      repeat: 'daily',
    });
    form.taskDraft = taskDraft({
      title: 'Evening walk',
      time: '18:45',
      reminderTime: '18:30',
      repeat: 'weekly',
      color: 'lavender',
    });
    form.save.emit(form.taskDraft);

    expect(app.selectedTasks).toHaveLength(1);
    expect(app.selectedTasks[0]).toMatchObject({
      id: taskId,
      title: 'Evening walk',
      time: '18:45',
      reminderTime: '18:30',
      repeat: 'weekly',
      color: 'lavender',
      completed: true,
    });
  });

  it('should accept task time in a 12-hour text field', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.isAddingTask = true;
    fixture.detectChanges();

    const form = fixture.debugElement.query(By.directive(TaskFormComponent))
      .componentInstance as TaskFormComponent;
    const root = fixture.nativeElement as HTMLElement;
    const timeInput = root.querySelector<HTMLInputElement>('input[name="taskTime"]');
    expect(timeInput?.type).toBe('text');
    if (timeInput) {
      timeInput.value = '08:15 PM';
      timeInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await fixture.whenStable();
    expect(form.taskDraft.time).toBe('20:15');
    expect(root.querySelector('.task-time-wheels')).toBeNull();
  });

  it('should apply and remove a reminder through the reminder component', () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.isAddingTask = true;
    fixture.detectChanges();

    const reminder = fixture.debugElement.query(By.directive(ReminderComponent))
      .componentInstance as ReminderComponent;
    reminder.openReminderTimeModal();
    expect(reminder.isReminderTimeModalOpen).toBe(true);
    expect(reminder.reminderTimeDraft).toBe('09:00');

    const changes: Array<{ time: string; sendNotification: boolean }> = [];
    reminder.reminderChange.subscribe((settings) => changes.push(settings));
    reminder.selectReminderTime('14:15');
    reminder.applyReminderTime();
    expect(changes.at(-1)).toEqual({ time: '14:15', sendNotification: false });

    reminder.reminderTime = '14:15';
    reminder.openReminderTimeModal();
    reminder.removeNewTaskReminder();
    expect(changes.at(-1)).toEqual({ time: '', sendNotification: false });
  });

  it('should support manual reminder entry in 12-hour and 24-hour formats', () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.isAddingTask = true;
    fixture.detectChanges();
    const reminder = fixture.debugElement.query(By.directive(ReminderComponent))
      .componentInstance as ReminderComponent;
    reminder.openReminderTimeModal();

    reminder.updateReminderTimeFromManualEntry('4:05');
    expect(reminder.reminderTimePreview).toBe('04:05 AM');
    reminder.updateReminderPeriod('PM');
    expect(reminder.reminderTimePreview).toBe('04:05 PM');

    reminder.setReminderTimeFormat('24-hour');
    reminder.updateReminderTimeFromManualEntry('00:30');
    expect(reminder.reminderTimePreview).toBe('00:30');
    reminder.updateReminderTimeFromManualEntry('24:30');
    expect(reminder.isValidManualReminderTime).toBe(false);
    expect(reminder.reminderTimePreview).toBe('--:--');
  });

  it('should switch calendar views and select a day', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.setView('month');
    expect(app.monthDays).toHaveLength(42);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const dayButton = root.querySelector<HTMLElement>('.month-day');
    expect(dayButton).toBeTruthy();
    const expectedDate = app.monthDays[0].date;
    dayButton?.click();
    fixture.detectChanges();
    expect(app.view).toBe('month');
    expect(app.selectedDate.toDateString()).toBe(expectedDate.toDateString());
  });

  it('should track recurring task completion per day and repeat monthly at month end', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.selectDate(new Date(2026, 0, 5));
    app.addTask(taskDraft({ title: 'Weekly planning', repeat: 'weekly' }));
    const weeklyTaskId = app.selectedTasks[0].id;
    app.toggleTask(weeklyTaskId);
    expect(app.selectedTasks[0].completed).toBe(true);

    app.selectDate(new Date(2026, 0, 12));
    expect(app.selectedTasks).toHaveLength(1);
    expect(app.selectedTasks[0].completed).toBe(false);

    app.selectDate(new Date(2026, 0, 31));
    app.addTask(taskDraft({ title: 'Monthly review', repeat: 'monthly' }));
    app.selectDate(new Date(2026, 1, 28));
    expect(app.selectedTasks.some((task) => task.title === 'Monthly review')).toBe(true);
  });
});
