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

  it('should initialize task fields and time-wheel values when editing', () => {
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
    expect(component.newTaskHourDraft).toBe('08');
    expect(component.newTaskMinuteDraft).toBe('35');
    expect(component.newTaskPeriodDraft).toBe('PM');
  });

  it('should update the task time from wheel scrolling and emit cancel', () => {
    const fixture = TestBed.createComponent(TaskFormComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const root = fixture.nativeElement as HTMLElement;
    const hourWheel = root.querySelector<HTMLElement>('[aria-label="Task hour"]');
    const minuteWheel = root.querySelector<HTMLElement>('[aria-label="Task minute"]');
    const periodWheel = root.querySelector<HTMLElement>('[aria-label="AM or PM"]');

    const canceled: boolean[] = [];
    component.cancel.subscribe(() => canceled.push(true));
    if (hourWheel && minuteWheel && periodWheel) {
      hourWheel.scrollLeft = 8 * 40;
      hourWheel.dispatchEvent(new Event('scroll'));
      minuteWheel.scrollLeft = 36 * 40;
      minuteWheel.dispatchEvent(new Event('scroll'));
      periodWheel.scrollLeft = 2 * 40;
      periodWheel.dispatchEvent(new Event('scroll'));
    }
    expect(component.taskDraft.time).toBe('20:35');

    component.cancel.emit();
    expect(canceled).toEqual([true]);
  });
});
