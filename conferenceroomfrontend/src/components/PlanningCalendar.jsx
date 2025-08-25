import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api, { getAllRooms, getOrganizations, setDayVisibility } from '../utils/api';

const HOURS = Array.from({ length: 10 }, (_, i) => 7 + i); // 7..16 (blocks represent [h, h+1))
const DAYS = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY'];

const toIso = (date) => date.toISOString().slice(0,16);

const startOfDay = (d) => { const x = new Date(d); x.setHours(7,0,0,0); return x; };
const endOfDay = (d) => { const x = new Date(d); x.setHours(17,0,0,0); return x; };

export default function PlanningCalendar() {
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    const day = now.getDay(); // 0 Sun..6 Sat
    const diffToMon = (day + 6) % 7; // 0 for Mon
    const d = new Date(now);
    d.setDate(now.getDate() - diffToMon);
    d.setHours(0,0,0,0);
    return d;
  });

  const [selectedOrgId, setSelectedOrgId] = useState('ALL');
  const { data: orgs } = useQuery({ queryKey: ['orgs'], queryFn: () => getOrganizations().then(r => r.data || []) });
  const { data: rooms } = useQuery({ queryKey: ['allRoomsForCalendar', selectedOrgId], queryFn: async () => {
    const res = await getAllRooms({});
    const all = res.data || [];
    if (selectedOrgId && selectedOrgId !== 'ALL') {
      return all.filter(r => r.organizationId === selectedOrgId);
    }
    return all;
  }});
  const { data: allBookings } = useQuery({ queryKey: ['allBookingsForCalendar'], queryFn: () => api.get('/booking').then(r => r.data || []) , refetchInterval: 10000 });

  const daysDates = useMemo(() => DAYS.map((_, idx) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + idx)), [weekStart]);

  const nextWeek = () => setWeekStart(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7));
  const prevWeek = () => setWeekStart(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() - 7));

  const isSlotBooked = (roomId, slotStart) => {
    if (!allBookings) return false;
    const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
    return allBookings.some(b => (b.roomId === roomId) && b.isActive && b.status !== 'CANCELLED' && b.status !== 'REJECTED' && (new Date(b.startTime) < slotEnd) && (new Date(b.endTime) > slotStart));
  };

  // Day click -> list available rooms
  const [modalOpen, setModalOpen] = useState(false);
  const [modalRooms, setModalRooms] = useState([]);
  const [modalTitle, setModalTitle] = useState('');
  const [weekFreeOnly, setWeekFreeOnly] = useState(false);
  const [selectedForVisibility, setSelectedForVisibility] = useState({});
  const [saving, setSaving] = useState(false);

  const hasConflictOnWindow = (roomId, windowStart, windowEnd) => {
    if (!allBookings) return false;
    return allBookings.some(b => (b.roomId === roomId) && b.isActive && b.status !== 'CANCELLED' && b.status !== 'REJECTED' && (new Date(b.startTime) < windowEnd) && (new Date(b.endTime) > windowStart));
  };

  const computeRoomsForDay = (dayIdx, wholeWeek) => {
    if (!rooms) return [];
    const dayDate = daysDates[dayIdx];
    const dayStart = startOfDay(dayDate);
    const dayEnd = endOfDay(dayDate);
    return rooms.filter(r => {
      if (wholeWeek) {
        // Room must be free every weekday of current week 7-17
        for (let i = 0; i < DAYS.length; i++) {
          const d = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i);
          const wStart = startOfDay(d);
          const wEnd = endOfDay(d);
          if (hasConflictOnWindow(r.id, wStart, wEnd)) return false;
        }
        return true;
      }
      return !hasConflictOnWindow(r.id, dayStart, dayEnd);
    });
  };

  const openDay = (dayIdx) => {
    const avail = computeRoomsForDay(dayIdx, weekFreeOnly);
    setModalRooms(avail);
    setModalTitle(`${DAYS[dayIdx]} • ${daysDates[dayIdx].toLocaleDateString()}`);
    setSelectedForVisibility({});
    setModalOpen(true);
  };

  return (
    <div className="container text-gray-500 p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-['Poppins']">Planning Calendar</h1>
        <div className="space-x-2 flex items-center">
          <div>
            <label className="mr-2 text-sm text-gray-400">Organization</label>
            <select className="bg-gray-800 border border-gray-700 rounded px-2 py-1" value={selectedOrgId} onChange={e=>setSelectedOrgId(e.target.value)}>
              <option value="ALL">All</option>
              {orgs?.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <button onClick={prevWeek} className="px-3 py-1 bg-gray-700 rounded">Prev Week</button>
          <button onClick={nextWeek} className="px-3 py-1 bg-gray-700 rounded">Next Week</button>
        </div>
      </div>
      <div className="overflow-auto border border-gray-700 rounded">
        <table className="min-w-[900px] w-full text-xs">
          <thead className="bg-gray-800">
            <tr>
              <th className="p-2 text-left">Room</th>
              {DAYS.map((d, i) => (
                <th key={d} className="p-2 text-left">
                  <button onClick={() => openDay(i)} className="underline underline-offset-2 hover:text-white">
                    {d} {daysDates[i].toLocaleDateString()}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rooms?.map(room => (
              <tr key={room.id} className="border-t border-gray-700">
                <td className="align-top p-2 font-semibold">{room.name}</td>
                {daysDates.map((dayDate, di) => (
                  <td key={di} className="p-1">
                    <div className="grid grid-cols-5 gap-1">
                      {HOURS.map(h => {
                        const slotStart = new Date(dayDate); slotStart.setHours(h,0,0,0);
                        const booked = isSlotBooked(room.id, slotStart);
                        return (
                          <div key={h} title={`${h}:00-${h+1}:00`} className={`h-3 rounded ${booked ? 'bg-yellow-500' : 'bg-green-600'}`}></div>
                        );
                      })}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-sm text-gray-400">Legend: <span className="inline-block w-3 h-3 bg-green-600 mr-1"/> Available <span className="inline-block w-3 h-3 bg-yellow-500 mx-1"/> Booked</div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-2xl w-full">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">Available Rooms</div>
                <div className="text-sm text-gray-400">{modalTitle}</div>
              </div>
              <button onClick={()=>setModalOpen(false)} className="px-2 py-1 bg-gray-700 rounded">Close</button>
            </div>
            <div className="p-4 space-y-3">
              <label className="flex items-center space-x-2 text-sm text-gray-300">
                <input type="checkbox" checked={weekFreeOnly} onChange={(e)=>{setWeekFreeOnly(e.target.checked); setModalRooms(computeRoomsForDay(DAYS.findIndex(d=>modalTitle.startsWith(d)), e.target.checked));}} />
                <span>Only show rooms free the entire week (Mon–Fri)</span>
              </label>
              {modalRooms.length === 0 ? (
                <div className="text-gray-400">No rooms match the selected criteria.</div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs text-gray-400">Select rooms to be visible to users on this day</div>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {modalRooms.map(r => (
                      <li key={r.id} className={`p-3 rounded border ${selectedForVisibility[r.id] ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 bg-gray-800'}`}>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={!!selectedForVisibility[r.id]} onChange={(e)=>setSelectedForVisibility(prev=>({ ...prev, [r.id]: e.target.checked }))} />
                          <div>
                            <div className="font-semibold text-white">{r.name}</div>
                            <div className="text-xs text-gray-400">Capacity: {r.capacity} • {r.location}</div>
                            {r.organizationName && <div className="text-xs text-gray-400">Org: {r.organizationName}</div>}
                          </div>
                        </label>
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-end gap-2">
                    <button disabled={saving} onClick={async ()=>{
                      setSaving(true);
                      try {
                        const day = daysDates[DAYS.findIndex(d=>modalTitle.startsWith(d))];
                        const y = day.getFullYear();
                        const m = String(day.getMonth()+1).padStart(2,'0');
                        const d = String(day.getDate()).padStart(2,'0');
                        const date = `${y}-${m}-${d}`;
                        const roomIds = Object.entries(selectedForVisibility).filter(([,v])=>v).map(([k])=>k);
                        await setDayVisibility(date, roomIds);
                        alert('Day visibility saved');
                        setModalOpen(false);
                      } catch (e) {
                        alert('Failed to save day visibility');
                      } finally {
                        setSaving(false);
                      }
                    }} className={`px-3 py-1 rounded ${saving ? 'bg-gray-600' : 'bg-blue-600 hover:bg-blue-700'} text-white`}>{saving ? 'Saving...' : 'Save Visibility'}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


