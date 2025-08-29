import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api, { getOrganizationRooms, deleteRoom, createRoom, updateRoom, getOrganizations } from '../utils/api';
import { useNavigate, useLocation } from 'react-router-dom';
import MonthCalendar from './MonthCalendar';
import { FaEdit, FaTrash, FaPlus, FaSearch, FaCalendarTimes, FaBoxOpen } from 'react-icons/fa';

const Room = ({ userRole }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const urlParams = new URLSearchParams(location.search);
  const dateParam = urlParams.get('date'); // YYYY-MM-DD
  const [selectedDay, setSelectedDay] = useState(dateParam ? new Date(`${dateParam}T00:00:00`) : null);
  const onPickDay = (d) => {
    setSelectedDay(d);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    navigate(`/rooms?date=${y}-${m}-${dd}`);
  };
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 8; // 4 columns x 2 rows
  const [newRoom, setNewRoom] = useState({
    name: '',
    capacity: '',
    location: '',
    floor: '',
    description: '',
    amenities: '',
    equipment: '',
    imageFiles: [],
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Normal user filters
  const [selectedOrgId, setSelectedOrgId] = useState('ALL');
  
  // User profile modal
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  // Room details modal
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [detailsRoom, setDetailsRoom] = useState(null);
  const [hoveredRoomId, setHoveredRoomId] = useState(null);

  // Debounce search term (900ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 900);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Reset to first page when debounced search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm]);

  const { data: roomsData, isLoading, error: fetchError } = useQuery({
    queryKey: ['rooms', userRole, debouncedSearchTerm, currentPage, dateParam, selectedOrgId],
    queryFn: async () => {
      // If a date is provided and normal user, fetch ALL rooms with availability details
      if (userRole === 'USER' && dateParam) {
        const start = new Date(`${dateParam}T07:00:00`);
        const end = new Date(`${dateParam}T17:00:00`);
        // If selected day is today and after 17:00, don't show rooms
        const now = new Date();
        const isToday = new Date(dateParam).toDateString() === new Date().toDateString();
        if (isToday && (now.getHours() > 17 || (now.getHours() === 17 && now.getMinutes() > 0))) {
          setTotalPages(1);
          return [];
        }
        try {
          // Use the new availability endpoint to get ALL rooms with booking details
          // Send local datetime without timezone suffix so backend LocalDateTime.parse() works
          const selectedLocal = `${dateParam}T00:00:00`;
          console.log('Calling /room/availability with date:', selectedLocal);
          const res = await api.get('/room/availability', { params: { date: selectedLocal } });
          console.log('Availability API response:', res.data);
          let allRooms = res.data || [];
          console.log('All rooms from API:', allRooms.length);
          // Optional org filter (user-only)
          if (selectedOrgId && selectedOrgId !== 'ALL') {
            allRooms = allRooms.filter(r => r.organizationId === selectedOrgId);
            console.log('After org filter:', allRooms.length);
          }
          const filtered = debouncedSearchTerm
            ? allRooms.filter(room =>
                room.name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                room.location?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                room.description?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
              )
            : allRooms;
          console.log('After search filter:', filtered.length);
          setTotalPages(Math.ceil(filtered.length / pageSize) || 1);
          const startIdx = (currentPage - 1) * pageSize;
          const result = filtered.slice(startIdx, startIdx + pageSize);
          console.log('Final result:', result.length);
          return result;
        } catch (e) {
          // Do NOT fall back to all rooms; if availability fails or none visible, show none
          setTotalPages(1);
          return [];
        }
      }
      // If a date is provided and admin/system admin, allow available-fetch first, otherwise fall back
      if (dateParam && (userRole === 'ADMIN' || userRole === 'SYSTEM_ADMIN')) {
        const start = new Date(`${dateParam}T07:00:00`);
        const end = new Date(`${dateParam}T17:00:00`);
        try {
          const res = await api.get('/room/available', { params: { startTime: start.toISOString(), endTime: end.toISOString() } });
          const allRooms = res.data || [];
          const filtered = debouncedSearchTerm
            ? allRooms.filter(room =>
                room.name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                room.location?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                room.description?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
              )
            : allRooms;
          setTotalPages(Math.ceil(filtered.length / pageSize) || 1);
          const startIdx = (currentPage - 1) * pageSize;
          return filtered.slice(startIdx, startIdx + pageSize);
        } catch (e) {
          // fall through to role-based fetch
        }
      }
      if (userRole === 'ADMIN') {
        // Fetch all organization rooms (not paginated)
        const res = await getOrganizationRooms({});
        const allRooms = res.data.content || [];
        const filtered = debouncedSearchTerm
          ? allRooms.filter(room =>
              room.name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
              room.location?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
              room.description?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
            )
          : allRooms;
        setTotalPages(Math.ceil(filtered.length / pageSize) || 1);
        const start = (currentPage - 1) * pageSize;
        const paginated = filtered.slice(start, start + pageSize);
        return paginated;
      } else if (userRole === 'SYSTEM_ADMIN') {
        const res = await api.get('/room/all');
        const allRooms = res.data;
        const filtered = debouncedSearchTerm
          ? allRooms.filter(room =>
              room.name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
              room.location?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
              room.description?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
            )
          : allRooms;
        setTotalPages(Math.ceil(filtered.length / pageSize) || 1);
        const start = (currentPage - 1) * pageSize;
        const paginated = filtered.slice(start, start + pageSize);
        return paginated;
      } else if (userRole === 'USER') {
        // No date selected: don't show any rooms for normal users
        setTotalPages(1);
        return [];
      }
      return [];
    },
    enabled: !!userRole && (userRole !== 'USER' || !!dateParam),
    refetchOnWindowFocus: true,
  });

  const rooms = roomsData;
  const { data: organizations } = useQuery({
    queryKey: ['organizationsForUserRooms'],
    queryFn: () => getOrganizations().then(r => r.data || []),
    enabled: userRole === 'USER'
  });

  const handleBookRoom = (roomId) => {
    navigate(`/booking/${roomId}`);
  };

  const handleUserProfileClick = (user) => {
    setSelectedUser(user);
    setIsProfileModalOpen(true);
  };

  const handleProfileModalClose = () => {
    setIsProfileModalOpen(false);
    setSelectedUser(null);
  };

  const openRoomDetails = (room) => {
    setDetailsRoom(room);
    setIsDetailsOpen(true);
  };

  const closeRoomDetails = () => {
    setIsDetailsOpen(false);
    setDetailsRoom(null);
  };

  const handleAddRoomClick = () => {
    setEditingRoom(null);
    setNewRoom({
      name: '',
      capacity: '',
      location: '',
      floor: '',
      description: '',
      amenities: '',
      equipment: '',
      imageFiles: [],
    });
    setIsModalOpen(true);
  };

  const handleEditRoomClick = (room) => {
    setEditingRoom(room);
    setNewRoom({
      id: room.id || '',
      name: room.name || '',
      capacity: room.capacity || '',
      location: room.location || '',
      floor: room.floor || '',
      description: room.description || '',
      amenities: room.amenities || '',
      equipment: room.equipment || '',
      imageFiles: [], // Clear any previously selected new files
      // existingImages: room.images ? JSON.parse(room.images) : [], // Keep track of existing images if needed for display
    });
    setIsModalOpen(true);
    setError('');
    setSuccess('');
  };

  const handleDeleteRoom = async (roomId) => {
    if (window.confirm("Are you sure you want to delete this room?")) {
      try {
        await deleteRoom(roomId);
        setSuccess('Room deleted successfully!');
        queryClient.invalidateQueries(['rooms']);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to delete room.');
      }
    }
  };

  

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingRoom(null);
    setNewRoom({
      name: '',
      capacity: '',
      location: '',
      floor: '',
      description: '',
      amenities: '',
      equipment: '',
      imageFiles: [],
    });
    setError('');
    setSuccess('');
  };

  const handleRoomInputChange = (e) => {
    const { name, value } = e.target;
    setNewRoom(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageFileChange = (e) => {
    setNewRoom(prev => ({
      ...prev,
      imageFiles: Array.from(e.target.files)
    }));
  };

  const handleRoomSubmit = async (e) => {
    e.preventDefault();
    
    // Prevent multiple submissions
    if (isSubmitting) {
      setError('Please wait, processing your request...');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    const formData = new FormData();

    // Always append required fields, even if their value is empty
    formData.append('name', newRoom.name || '');
    formData.append('location', newRoom.location || '');
    formData.append('capacity', newRoom.capacity ? Number(newRoom.capacity) : 0); // Ensure capacity is a number

    // Append optional fields only if they have a value
    if (newRoom.description) formData.append('description', newRoom.description);
    if (newRoom.floor) formData.append('floor', newRoom.floor);
    if (newRoom.amenities) formData.append('amenities', newRoom.amenities);
    if (newRoom.equipment) formData.append('equipment', newRoom.equipment);

    // Handle image files
    if (newRoom.imageFiles && newRoom.imageFiles.length > 0) {
      newRoom.imageFiles.forEach(file => formData.append('images', file));
    }

    try {
      if (editingRoom) {
        await updateRoom(editingRoom.id, formData);
        setSuccess('Room updated successfully!');
      } else {
        await createRoom(formData);
        setSuccess('Room created successfully!');
      }
      queryClient.invalidateQueries(['rooms']);
      setIsSubmitting(false);
      handleModalClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save room.');
      setIsSubmitting(false);
    }
  };

  const getImageUrl = (imagePath) => {
    if (imagePath && typeof imagePath === 'string') {
        return `${import.meta.env.VITE_API_URL}/${imagePath.startsWith('/') ? imagePath.substring(1) : imagePath}`;
    }
    // Return a data URL for placeholder if no valid path is provided
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjM2I0MjU5Ii8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTYiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tm8gSW1hZ2U8L3RleHQ+Cjwvc3ZnPgo=';
};

  const handleImageError = (e) => {
    // Use a data URL for the fallback image to avoid infinite loops
    e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjMTBiOTgxIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTYiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Um9vbTwvdGV4dD4KPC9zdmc+Cg==';
  };

  const getRoomImage = (room) => {
    try {
      if (room.images) {
        const parsedImages = JSON.parse(room.images);
        if (Array.isArray(parsedImages) && parsedImages.length > 0) {
          return parsedImages[0];
        }
      }
    } catch (error) {
      console.warn('Failed to parse room images:', error);
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-600 flex items-center justify-center">
        <div className="flex items-center space-x-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-500"></div>
          <div className="text-gray-300 text-xl">Loading rooms...</div>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className=" border-gray-200 min-h-screen bg-gray-700 flex items-center justify-center p-6">
        <div className="bg-red-500/20 border border-red-400/50 rounded-xl p-6 text-red-200 backdrop-blur-sm max-w-md">
          <div className="flex items-center space-x-3">
            <svg className="w-6 h-6 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
            </svg>
            <span className="text-lg font-medium">Error: {fetchError.message || "Failed to load rooms."}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-['Poppins'] bg-gray-500 bg-clip-text text-transparent mb-2">
          {userRole === 'ADMIN' ? 'Organization Rooms' : userRole === 'SYSTEM_ADMIN' ? 'All Rooms' : 'All Rooms'}
        </h1>
        <p className="text-gray-500">
          {userRole === 'ADMIN' 
            ? 'Manage and control your organization\'s conference rooms' 
            : userRole === 'SYSTEM_ADMIN' 
              ? 'Browse and manage all conference rooms across all organizations'
              : 'Browse and book available conference rooms'
          }
        </p>
        {userRole === 'USER' && (
          <div className="mt-4 space-y-3">
            <MonthCalendar value={selectedDay} onChange={onPickDay} />
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400">Organization</label>
              <select
                className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-gray-200 text-sm"
                value={selectedOrgId}
                onChange={(e)=>{ setSelectedOrgId(e.target.value); setCurrentPage(1);} }
              >
                <option value="ALL">All</option>
                {organizations?.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
            <div className="text-xs text-gray-400">{dateParam ? `Showing rooms available on ${dateParam} between 07:00–17:00` : 'Pick a weekday to see rooms available that day (07:00–17:00).'}</div>
          </div>
        )}
        <div className="mt-4 w-24 h-1 bg-gradient-to-r from-green-400 to-blue-400 rounded-full"></div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-200">
          {success}
        </div>
      )}

      {/* Search and Add Room */}
      {(userRole !== 'USER' || !!dateParam) && (
        <div className="flex justify-between items-center mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search rooms..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-700 rounded-sm text-white placeholder-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <FaSearch className="absolute left-3 top-3 text-gray-400" />
          </div>
          {userRole === 'ADMIN' && (
            <button
              onClick={handleAddRoomClick}
              className="flex items-center space-x-2 px-4 py-2 bg-white text-black transition-all duration-200"
            >
              <FaPlus />
              <span>Add Room</span>
            </button>
          )}
        </div>
      )}
      

      {/* Masonry Grid for Rooms */}
      {(userRole !== 'USER' || !!dateParam) && (
      <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-8'>
        {rooms?.map(room => (
          <div key={room.id}
            className="bg-gray-800/50 backdrop-blur-sm rounded-xl overflow-hidden border border-gray-700 hover:border-green-500/50 transition-all duration-200 break-inside-avoid relative"
            onMouseEnter={() => (userRole === 'USER' || userRole === 'ADMIN' || userRole === 'SYSTEM_ADMIN') && setHoveredRoomId(room.id)}
            onMouseLeave={() => (userRole === 'USER' || userRole === 'ADMIN' || userRole === 'SYSTEM_ADMIN') && setHoveredRoomId(null)}
          >
            <div className="relative h-48">
              
              {/* Admin name on left side for organization admin and system admin */}
              {(userRole === 'ADMIN' || userRole === 'SYSTEM_ADMIN') && (
                <div className="absolute top-2 left-2 z-30 bg-black/60 px-3 py-1 rounded text-white text-sm font-bold pointer-events-none">
                  {room.name || 'Admin'}
                </div>
              )}
              
              {/* For normal users, show name badge; for org admins, show edit/delete */}
              {userRole === 'USER' && (
                <div className="absolute top-2 right-2 z-30 bg-black/60 px-3 py-1 rounded text-white text-sm font-bold pointer-events-none">
                  {room.name}
                </div>
              )}
              {userRole === 'ADMIN' && (
                <div className="absolute top-2 right-2 z-30 flex space-x-2">
                  <button
                    onClick={() => handleEditRoomClick(room)}
                    className="p-2 bg-blue-500/80 text-white rounded-lg hover:bg-blue-600/80 transition-colors"
                  >
                    <FaEdit />
                  </button>
                  <button
                    onClick={() => handleDeleteRoom(room.id)}
                    className="p-2 bg-red-500/80 text-white rounded-lg hover:bg-red-600/80 transition-colors"
                  >
                    <FaTrash />
                  </button>
                </div>
              )}
              {userRole === 'SYSTEM_ADMIN' && (
                <div className="absolute top-2 right-2 z-30 flex space-x-2">
                  <button
                    onClick={() => handleDeleteRoom(room.id)}
                    className="p-2 bg-red-500/80 text-white rounded-lg hover:bg-red-600/80 transition-colors"
                  >
                    <FaTrash />
                  </button>
                </div>
              )}
              {/* Overlay for normal users on hover (only on image) */
              }
              {userRole === 'USER' && hoveredRoomId === room.id && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-20 transition-opacity">
                  <button
                    onClick={() => openRoomDetails(room)}
                    className="mb-3 px-4 py-2 bg-white/20 text-cyan-300 rounded-full text-base hover:bg-white/30 transition-colors w-30"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => handleBookRoom(room.id)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-full text-base hover:bg-white hover:text-black transition-all duration-200 w-30"
                  >
                    Book Room
                  </button>
                </div>
              )}
              {/* Overlay for admins and system admins on hover (view details only) */}
              {(userRole === 'ADMIN' || userRole === 'SYSTEM_ADMIN') && hoveredRoomId === room.id && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20 transition-opacity">
                  <button
                    onClick={() => openRoomDetails(room)}
                    className="px-4 py-2 bg-white/20 text-cyan-300 rounded-lg text-base hover:bg-white/30 transition-colors w-44"
                  >
                    View Details
                  </button>
                </div>
              )}
              <img
                src={getImageUrl(getRoomImage(room))}
                alt={room.name}
                onError={handleImageError}
                className="w-full h-full object-cover"
              />
            </div>
            
          </div>
        ))}
      </div>
      )}

      {userRole === 'USER' && !dateParam && (
        <div className="text-gray-400 text-sm mt-6">Pick a weekday on the calendar above to see rooms available that day.</div>
      )}

      {userRole === 'USER' && !!dateParam && (rooms?.length === 0) && (
        <div className=" p-12 my-12 w-full">
          {(() => {
            const now = new Date();
            const currentHour = now.getHours();
            const selectedDate = new Date(dateParam);
            const isToday = selectedDate.toDateString() === now.toDateString();
            const isWeekend = selectedDate.getDay() === 0 || selectedDate.getDay() === 6;
            const isPastDate = selectedDate < new Date(now.setHours(0, 0, 0, 0));
            
            if (isPastDate) {
              return (
                <div className="text-center">
                  <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">Past Date Selected</h3>
                  <p className="text-lg text-gray-300 max-w-2xl mx-auto leading-relaxed">
                    You cannot book rooms for past dates. Please select a current or future weekday from the calendar above.
                  </p>
                  <div className="mt-8 flex justify-center space-x-4">
                    <button 
                      onClick={() => onPickDay(new Date())}
                      className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-200 font-medium"
                    >
                      Select Today
                    </button>
                    <button 
                      onClick={() => onPickDay(new Date(Date.now() + 24 * 60 * 60 * 1000))}
                      className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all duration-200 font-medium"
                    >
                      Select Tomorrow
                    </button>
                  </div>
                </div>
              );
            } else if (isWeekend) {
              return (
                <div className="text-center">
                  <div className="w-24 h-24 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-12 h-12 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">Weekend - No Bookings Available</h3>
                  <p className="text-lg text-gray-300 max-w-2xl mx-auto leading-relaxed">
                    Room bookings are only available Monday through Friday during business hours (7:00 AM - 5:00 PM).
                  </p>
                  <div className="mt-8">
                    <p className="text-gray-400 text-sm">Please select a weekday from the calendar above to continue.</p>
                  </div>
                </div>
              );
            } else if (isToday && currentHour >= 17) {
              return (
                <div className="text-center">
                  <div className="w-24 h-24 flex items-center justify-center mx-auto mb-6">
                    <svg className="w-12 h-12 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                  </div>
                  <h3 className="text-2xl font-['Poppins'] text-white mb-4">Today's Booking Period Ended</h3>
                  <p className="text-lg text-gray-300 max-w-2xl mx-auto leading-relaxed">
                    Today's booking period has ended (5:00 PM). All rooms are now closed for today.
                  </p>
                  <div className="mt-6 p-4 bg-gray-700/50 rounded-lg border border-gray-600 max-w-md mx-auto">
                    <p className="text-gray-300 font-medium">Bookings reopen tomorrow at 7:00 AM</p>
                  </div>
                  <div className="mt-8">
                    <button 
                      onClick={() => onPickDay(new Date(Date.now() + 24 * 60 * 60 * 1000))}
                      className="px-6 py-3 bg-white text-black rounded-lg hover:from-green-600 hover:to-blue-600 transition-all duration-200 font-medium"
                    >
                      Book for Tomorrow
                    </button>
                  </div>
                </div>
              );
            } else if (isToday && currentHour < 7) {
              return (
                <div className="text-center">
                  <div className="w-24 h-24 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-12 h-12 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">Business Hours Not Started</h3>
                  <p className="text-lg text-gray-300 max-w-2xl mx-auto leading-relaxed">
                    Room bookings open at 7:00 AM. Please check back during business hours.
                  </p>
                  <div className="mt-6 p-4 bg-gray-700/50 rounded-lg border border-gray-600 max-w-md mx-auto">
                    <p className="text-gray-300 font-medium">Business Hours: 7:00 AM - 5:00 PM</p>
                  </div>
                </div>
              );
            } else {
              return (
                <div className="text-center">
                  <div className="w-24 h-24  flex items-center justify-center mx-auto mb-6">
                    <FaCalendarTimes className="text-5xl text-gray-400" />
                  </div>
                  <h3 className="text-2xl font-['Poppins'] text-white mb-4">No Rooms Found</h3>
                  <p className="text-lg text-gray-300 max-w-2xl mx-auto leading-relaxed">
                    No rooms were found for this date. This could be due to organization filters or no rooms being created yet. Try adjusting your organization filter or contact your administrator.
                  </p>
                  <div className="mt-8 flex justify-center space-x-4">
                    <button 
                      onClick={() => onPickDay(new Date())}
                      className="px-6 py-3 bg-white text-black rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-200 font-medium"
                    >
                      Check Today
                    </button>
                    <button 
                      onClick={() => onPickDay(new Date(Date.now() + 24 * 60 * 60 * 1000))}
                      className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all duration-200 font-medium"
                    >
                      Check Tomorrow
                    </button>
                  </div>
                </div>
              );
            }
          })()}
        </div>
      )}

      {/* Pagination Controls */}
      <div className="flex justify-center items-center mt-8 space-x-4">
        <button
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className={`px-4 py-2 rounded-lg font-semibold ${currentPage === 1 ? 'bg-gray-600 text-gray-300 cursor-not-allowed' : 'bg-gradient-to-r from-green-500 to-blue-500 text-white hover:from-green-600 hover:to-blue-600'}`}
        >
          Previous
        </button>
        <span className="text-gray-500 font-medium">Page {currentPage} of {totalPages}</span>
        <button
          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
          className={`px-4 py-2 rounded-lg font-semibold ${currentPage === totalPages ? 'bg-gray-600 text-gray-300 cursor-not-allowed' : 'bg-gradient-to-r from-green-500 to-blue-500 text-white hover:from-green-600 hover:to-blue-600'}`}
        >
          Next
        </button>
      </div>

      {/* Add/Edit Room Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-white mb-6">
                {editingRoom ? 'Edit Room' : 'Add New Room'}
              </h2>
              <form onSubmit={handleRoomSubmit} className="space-y-4">
                <div>
                  <label className="block text-gray-300 mb-2">Room Name</label>
                  <input
                    type="text"
                    name="name"
                    value={newRoom.name}
                    onChange={handleRoomInputChange}
                    className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-2">Capacity</label>
                  <input
                    type="number"
                    name="capacity"
                    value={newRoom.capacity}
                    onChange={handleRoomInputChange}
                    className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-2">Location</label>
                  <input
                    type="text"
                    name="location"
                    value={newRoom.location}
                    onChange={handleRoomInputChange}
                    className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-2">Floor</label>
                  <input
                    type="text"
                    name="floor"
                    value={newRoom.floor}
                    onChange={handleRoomInputChange}
                    className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-2">Description</label>
                  <textarea
                    name="description"
                    value={newRoom.description}
                    onChange={handleRoomInputChange}
                    className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    rows="3"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-2">Amenities</label>
                  <input
                    type="text"
                    name="amenities"
                    value={newRoom.amenities}
                    onChange={handleRoomInputChange}
                    className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-2">Equipment</label>
                  <input
                    type="text"
                    name="equipment"
                    value={newRoom.equipment}
                    onChange={handleRoomInputChange}
                    className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-2">Room Images</label>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                {error && (
                  <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                    {error}
                  </div>
                )}
                <div className="flex justify-end space-x-4 mt-6">
                  <button
                    type="button"
                    onClick={handleModalClose}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`px-4 py-2 text-white rounded-lg transition-all duration-200 ${
                      isSubmitting 
                        ? 'bg-gray-500 cursor-not-allowed hover:from-gray-500 hover:to-gray-500' 
                        : 'bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600'
                    }`}
                  >
                    {isSubmitting 
                      ? (editingRoom ? 'Updating...' : 'Creating...') 
                      : (editingRoom ? 'Update Room' : 'Create Room')
                    }
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* User Profile Modal */}
      {isProfileModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">User Profile</h2>
                <button
                  onClick={handleProfileModalClose}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="text-center mb-6">
                {/* User Avatar */}
                <div className="w-24 h-24 rounded-full mx-auto mb-4 overflow-hidden">
                  {selectedUser.userProfilePicture ? (
                    <img 
                      src={getImageUrl(selectedUser.userProfilePicture)} 
                      alt={selectedUser.userName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div 
                    className={`w-full h-full ${selectedUser.userProfilePicture ? 'hidden' : 'flex'} items-center justify-center bg-gray-700`}
                  >
                    {selectedUser.userName ? (
                      <span className="text-white text-2xl font-bold">
                        {selectedUser.userName.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </span>
                    ) : (
                      <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
                      </svg>
                    )}
                  </div>
                </div>
                
                <h3 className="text-xl font-semibold text-white mb-2">{selectedUser.userName}</h3>
                <p className="text-gray-300">{selectedUser.userEmail}</p>
              </div>

              {/* Booking Details */}
              <div className="bg-gray-700/50 rounded-lg p-4 mb-6">
                <h4 className="text-lg font-medium text-white mb-3">Booking Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Date:</span>
                    <span className="text-white">{new Date(selectedUser.startTime).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Time:</span>
                    <span className="text-white">
                      {new Date(selectedUser.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - 
                      {new Date(selectedUser.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Purpose:</span>
                    <span className="text-white">{selectedUser.purpose}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Status:</span>
                    <span className={`px-2 py-1 text-xs rounded ${
                      selectedUser.status === 'APPROVED' ? 'bg-green-600 text-white' :
                      selectedUser.status === 'PENDING' ? 'bg-yellow-600 text-white' :
                      'bg-red-600 text-white'
                    }`}>
                      {selectedUser.status}
                    </span>
                  </div>
                  {selectedUser.attendeeCount && (
                    <div className="flex justify-between">
                      <span className="text-gray-300">Attendees:</span>
                      <span className="text-white">{selectedUser.attendeeCount}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleProfileModalClose}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Room Details Modal */}
      {isDetailsOpen && detailsRoom && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-['Poppins'] text-white">{detailsRoom.name}</h2>
                <button onClick={closeRoomDetails} className="text-gray-400 hover:text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="h-40 md:h-48">
                  <img src={getImageUrl(getRoomImage(detailsRoom))} alt={detailsRoom.name} className="w-full h-full object-cover rounded-lg" onError={handleImageError} />
                </div>
                <div className="text-gray-300 text-sm space-y-1">
                  <p><span className="text-green-400">Capacity:</span> {detailsRoom.capacity}</p>
                  <p><span className="text-green-400">Location:</span> {detailsRoom.location}</p>
                  <p><span className="text-green-400">Floor:</span> {detailsRoom.floor}</p>
                  {detailsRoom.organizationName && (
                    <p><span className="text-blue-400">Organization:</span> {detailsRoom.organizationName}</p>
                  )}
                </div>
              </div>

              {/* Simple Tabs */}
              <div className="mt-2 space-y-4">
                {/* Schedule */}
                {dateParam && detailsRoom.timeSlots && (
                  <div>
                    <h3 className="text-white font-semibold mb-2">Schedule for {new Date(dateParam).toLocaleDateString()}:</h3>
                    <div className="grid grid-cols-5 gap-1">
                      {detailsRoom.timeSlots.map((slot, idx) => (
                        <div key={idx} className={`text-xs p-2 rounded text-center ${slot.isAvailable ? 'bg-green-600' : 'bg-red-600'} text-white`}>
                          {new Date(slot.startTime).getHours()}:00
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bookings */}
                {dateParam && detailsRoom.todaysBookings && detailsRoom.todaysBookings.length > 0 && (
                  <div>
                    <h3 className="text-white font-semibold mb-2">Bookings</h3>
                    <div className="space-y-2">
                      {detailsRoom.todaysBookings.map((booking, index) => (
                        <div key={index} className="text-xs text-white/70 bg-white/5 p-2 rounded">
                          <div className="flex items-center space-x-2 mb-1">
                            <div className="w-8 h-8 rounded-full overflow-hidden cursor-pointer" onClick={() => handleUserProfileClick(booking)}>
                              {booking.userProfilePicture ? (
                                <img src={getImageUrl(booking.userProfilePicture)} alt={booking.userName} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-700 text-white">
                                  {booking.userName?.split(' ').map(n=>n[0]).join('').toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-white">{booking.userName}</div>
                              <div className="text-white/60 text-xs">{booking.userEmail}</div>
                            </div>
                          </div>
                          <div className="ml-10 text-white/80">
                            {new Date(booking.startTime).getHours()}:00 - {new Date(booking.endTime).getHours()}:00 · {booking.purpose}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* About */}
                <div>
                  <h3 className="text-white font-semibold mb-2">About</h3>
                  {detailsRoom.amenities && (
                    <p className="text-gray-300 text-sm"><span className="text-green-400">Amenities:</span> {detailsRoom.amenities}</p>
                  )}
                  {detailsRoom.equipment && (
                    <p className="text-gray-300 text-sm"><span className="text-green-400">Equipment:</span> {detailsRoom.equipment}</p>
                  )}
                </div>
              </div>

              {userRole === 'USER' && (
                <div className="mt-6 flex justify-end">
                  <button onClick={() => handleBookRoom(detailsRoom.id)} className="px-4 py-2 bg-white text-black rounded-sm ">Book Room</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Room;