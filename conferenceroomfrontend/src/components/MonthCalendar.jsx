import React, { useMemo, useState, useEffect } from 'react';

// Helpers
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

// Build a Mon-first month matrix (6 weeks x 7 days)
const buildMonthMatrix = (viewDate) => {
  const start = startOfMonth(viewDate);
  const end = endOfMonth(viewDate);
  const startWeekdayMonFirst = (start.getDay() + 6) % 7; // 0..6 (Mon..Sun)
  const daysInMonth = end.getDate();
  const cells = [];
  // before current month
  for (let i = 0; i < startWeekdayMonFirst; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() - (startWeekdayMonFirst - i));
    cells.push({ date: d, currentMonth: false });
  }
  // current month
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(start.getFullYear(), start.getMonth(), day);
    cells.push({ date: d, currentMonth: true });
  }
  // after current month to complete a 6x7 grid
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    const d = new Date(last);
    d.setDate(last.getDate() + 1);
    cells.push({ date: d, currentMonth: false });
  }
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
};

export default function MonthCalendar({ value, onChange }) {
  const [viewDate, setViewDate] = useState(() => value || new Date());

  useEffect(() => {
    if (value) setViewDate(value);
  }, [value]);

  const weeks = useMemo(() => buildMonthMatrix(viewDate), [viewDate]);

  const isSameDay = (a, b) => a && b && a.toDateString() === b.toDateString();
  const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;
  const monthLabel = viewDate.toLocaleString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
          className="px-2 py-1 rounded bg-gray-800 text-gray-200 border border-gray-700"
        >
          ‹
        </button>
        <div className="text-white font-semibold">{monthLabel}</div>
        <button
          type="button"
          onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
          className="px-2 py-1 rounded bg-gray-800 text-gray-200 border border-gray-700"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs text-gray-400 mb-1">
        {['Mo','Tu','We','Th','Fr','Sa','Su'].map((d) => (
          <div key={d} className="text-center py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-rows-6 gap-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map(({ date, currentMonth }, di) => {
              const selected = isSameDay(date, value);
              const disabled = !currentMonth || isWeekend(date) || date < new Date(new Date().toDateString());
              const base = disabled
                ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                : 'bg-gray-800 hover:bg-gray-700 text-gray-100 cursor-pointer';
              const active = selected ? 'ring-2 ring-blue-500' : '';
              return (
                <button
                  key={`${wi}-${di}`}
                  type="button"
                  title={date.toDateString()}
                  className={`h-10 rounded ${base} ${active}`}
                  disabled={disabled}
                  onClick={() => !disabled && onChange && onChange(date)}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 text-xs text-gray-400">Pick a weekday to view rooms available that day (07:00–17:00).</div>
    </div>
  );
}


