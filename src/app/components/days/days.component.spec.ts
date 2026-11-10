import { TestBed } from '@angular/core/testing';
import { CalendarDay } from '../../models';
import { DaysComponent } from './days.component';

const makeDay = (overrides: Partial<CalendarDay> = {}): CalendarDay => ({
  date: new Date(2026, 10, 9),
  key: '2026-11-09',
  dayName: 'Mon',
  dayNumber: 9,
  isCurrentMonth: true,
  isToday: true,
  isSelected: false,
  taskCount: 0,
  ...overrides,
});

describe('DaysComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DaysComponent],
    }).compileComponents();
  });

  it('should render week days and emit the selected date', () => {
    const fixture = TestBed.createComponent(DaysComponent);
    const day = makeDay({ isSelected: true, taskCount: 2 });
    fixture.componentRef.setInput('weekDays', [day]);
    fixture.detectChanges();

    const emittedDates: Date[] = [];
    fixture.componentInstance.dateSelected.subscribe((date) => emittedDates.push(date));
    const root = fixture.nativeElement as HTMLElement;
    const button = root.querySelector<HTMLButtonElement>('.day-button');
    expect(button?.getAttribute('aria-pressed')).toBe('true');
    expect(button?.getAttribute('aria-label')).toContain('2 tasks');

    button?.click();
    expect(emittedDates).toEqual([day.date]);
  });

  it('should render task indicators in month view', () => {
    const fixture = TestBed.createComponent(DaysComponent);
    fixture.componentRef.setInput('view', 'month');
    fixture.componentRef.setInput('monthDays', [makeDay({ taskCount: 1 })]);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.month-day')).toBeTruthy();
    expect(root.querySelector('.task-indicator')).toBeTruthy();
    expect(root.querySelector('.week-strip')).toBeNull();
  });
});
