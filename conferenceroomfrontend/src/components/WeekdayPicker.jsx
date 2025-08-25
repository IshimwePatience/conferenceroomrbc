import React, { useMemo } from 'react';

const DAYS = ['Mon','Tue','Wed','Thu','Fri'];

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const diffToMon = (day + 6) % 7;
  d.setDate(d.getDate() - diffToMon);
  d.setHours(0,0,0,0);
  return d;
}

export default function WeekdayPicker({ value, onChange, weekStart, setWeekStart }) {
  const days = useMemo(() => {
    const base = weekStart ? new Date(weekStart) : startOfWeek(new Date());
    return Array.from({ length: 5 }, (_, i) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + i));
  }, [weekStart]);

  const isSameDay = (a, b) => a && b && a.toDateString() === b.toDateString();

  const nextWeek = () => setWeekStart(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7));
  const prevWeek = () => setWeekStart(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() - 7));

  return (
    <div className="w-full flex items-center justify-between">
      <button type="button" onClick={prevWeek} className="px-3 py-1 bg-gray-800 text-gray-200 rounded border border-gray-700">Prev</button>
      <div className="flex items-center gap-2">
        {days.map((d, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onChange(d)}
            className={`px-3 py-2 rounded border text-sm ${isSameDay(d, value) ? 'bg-blue-600 text-white border-blue-500' : 'bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700'}`}
            title={d.toDateString()}
          >
            <div className="text-center">
              <div>{DAYS[idx]}</div>
              <div className="text-xs opacity-80">{d.getDate()}</div>
            </div>
          </button>
        ))}
      </div>
      <button type="button" onClick={nextWeek} className="px-3 py-1 bg-gray-800 text-gray-200 rounded border border-gray-700">Next</button>
    </div>
  );
}


