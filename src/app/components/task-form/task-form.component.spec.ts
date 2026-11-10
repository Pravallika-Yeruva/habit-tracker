import { TestBed } from '@angular/core/testing';
import { HabitTask } from '../../models';
import { TaskFormComponent } from './task-form.component';

const makeTask = (overrides: Partial<HabitTask> = {}): HabitTask => ({
  id: 'task-1',
  title: 'Morning walk',
  date: '2026-11-09',
  completedDates: [],
  time: '20:35',
  reminderTime: '08:00',
  sendNotification: true,
  repeat: 'daily',
  color: 'sage',
  ...overrides,
});

describe('TaskFormComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskFormComponent],
    }).compileComponents();
  });

  it('should emit trimmed task details when submitted', () => {
    const fixture = TestBed.createComponent(TaskFormComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.taskDraft.title = '  Read every day  ';
    component.taskDraft.repeat = 'weekly';
    fixture.detectChanges();

    const savedTasks: unknown[] = [];
    component.save.subscribe((task) => savedTasks.push(task));
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLFormElement>('form')?.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );

    expect(savedTasks).toEqual([
      {
        title: 'Read every day',
        time: '',
        reminderTime: '',
        sendNotification: false,
        repeat: 'weekly',
        color: 'sage',
      },
    ]);
  });

  it('should fill the task title from a quick choice without changing other fields', () => {
    const fixture = TestBed.createComponent(TaskFormComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.taskDraft.time = '20:35';
    component.taskDraft.repeat = 'weekly';
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const quickTaskButton = Array.from(
      root.querySelectorAll<HTMLButtonElement>('.quick-task-button'),
    ).find((button) => button.textContent?.trim() === 'Gym');
    expect(quickTaskButton).toBeTruthy();
    quickTaskButton?.click();

    expect(component.taskDraft.title).toBe('Gym');
    expect(component.taskDraft.time).toBe('20:35');
    expect(component.taskDraft.repeat).toBe('weekly');
  });

  it('should initialize the text time input from a saved 24-hour time', async () => {
    const fixture = TestBed.createComponent(TaskFormComponent);
    fixture.componentRef.setInput('task', makeTask());
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.taskDraft).toMatchObject({
      title: 'Morning walk',
      time: '20:35',
      reminderTime: '08:00',
      sendNotification: true,
      repeat: 'daily',
    });
    const root = fixture.nativeElement as HTMLElement;
    const timeInput = root.querySelector<HTMLInputElement>('input[name="taskTime"]');
    expect(timeInput?.type).toBe('text');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(timeInput?.value).toBe('08:35 PM');
  });

  it('should convert a 12-hour text entry to the stored 24-hour time', async () => {
    const fixture = TestBed.createComponent(TaskFormComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const root = fixture.nativeElement as HTMLElement;
    const timeInput = root.querySelector<HTMLInputElement>('input[name="taskTime"]');
    expect(timeInput?.type).toBe('text');

    component.taskDraft.title = 'Morning walk';
    if (timeInput) {
      timeInput.value = '09:10 PM';
      timeInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await fixture.whenStable();
    expect(component.taskDraft.time).toBe('21:10');

    const savedTasks: unknown[] = [];
    component.save.subscribe((task) => savedTasks.push(task));
    component.submit();
    expect(savedTasks).toEqual([
      {
        title: 'Morning walk',
        time: '21:10',
        reminderTime: '',
        sendNotification: false,
        repeat: 'none',
        color: 'sage',
      },
    ]);
  });

  it('should reject invalid time text and allow an empty optional time', () => {
    const fixture = TestBed.createComponent(TaskFormComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    const timeInput = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      'input[name="taskTime"]',
    );
    if (!timeInput) {
      throw new Error('Task time input was not rendered.');
    }

    timeInput.value = '13:70 PM';
    timeInput.dispatchEvent(new Event('input', { bubbles: true }));
    expect(component.isTaskTimeValid).toBe(false);
    expect(component.taskDraft.time).toBe('');
    component.taskDraft.title = 'Morning walk';
    const savedTasks: unknown[] = [];
    component.save.subscribe((task) => savedTasks.push(task));
    component.submit();
    expect(savedTasks).toHaveLength(0);

    timeInput.value = '';
    timeInput.dispatchEvent(new Event('input', { bubbles: true }));
    expect(component.isTaskTimeValid).toBe(true);
    component.submit();
    expect(savedTasks).toHaveLength(1);
    expect(savedTasks[0]).toMatchObject({ time: '' });
  });
});
