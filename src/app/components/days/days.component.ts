import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CalendarDay, CalendarView } from '../../models';

@Component({
  selector: 'app-days',
  styleUrl: './days.component.scss',
  templateUrl: './days.component.html',
})
export class DaysComponent {
  @Input() view: CalendarView = 'week';
  @Input() weekDays: CalendarDay[] = [];
  @Input() monthDays: CalendarDay[] = [];
  @Output() dateSelected = new EventEmitter<Date>();
}
