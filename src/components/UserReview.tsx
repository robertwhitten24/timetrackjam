import React, { useState, useEffect } from 'react';
import { format, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import { Users, Clock, Calendar, ChevronRight, Filter, X } from 'lucide-react';

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string;
}

interface TimeEntry {
  id: string;
  start_time: string;
  end_time: string;
  description: string;
  project: {
    name: string;
    client: {
      name: string;
    };
  };
  user_id: string;
}

export default function UserReview() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [startDate, setStartDate] = useState(format(startOfWeek(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfWeek(new Date()), 'yyyy-MM-dd'));
  const [totalHours, setTotalHours] = useState(0);

  useEffect(() => {
    getCurrentUser();
    fetchProfiles();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      fetchTimeEntries();
    }
  }, [currentUserId, selectedUser, startDate, endDate]);

  async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  }

  async function fetchProfiles() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', user.id) // Exclude current user
      .order('full_name');
    
    if (data) setProfiles(data);
  }

  async function fetchTimeEntries() {
    if (!currentUserId) return;

    let query = supabase
      .from('time_entries')
      .select(`
        *,
        project:projects(
          name,
          client:clients(name)
        )
      `)
      .neq('user_id', currentUserId) // Exclude current user's entries
      .gte('start_time', `${startDate}T00:00:00`)
      .lte('end_time', `${endDate}T23:59:59`)
      .order('start_time', { ascending: false });

    if (selectedUser) {
      query = query.eq('user_id', selectedUser);
    }

    const { data } = await query;
    
    if (data) {
      setTimeEntries(data);
      
      // Calculate total hours
      const total = data.reduce((acc, entry) => {
        const duration = (new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / 1000 / 60 / 60;
        return acc + duration;
      }, 0);
      
      setTotalHours(total);
    }
  }

  function clearFilters() {
    setSelectedUser('');
    setStartDate(format(startOfWeek(new Date()), 'yyyy-MM-dd'));
    setEndDate(format(endOfWeek(new Date()), 'yyyy-MM-dd'));
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Users className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold text-gray-800">Team Activity</h2>
          </div>
          {(selectedUser || startDate || endDate) && (
            <button
              onClick={clearFilters}
              className="btn bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              <X className="w-4 h-4 mr-2" />
              Clear Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Team Member
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full"
            >
              <option value="">All Team Members</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              className="w-full"
            />
          </div>
        </div>

        {/* Summary Stats */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-gray-500">Total Team Hours</div>
              <div className="mt-1 text-2xl font-semibold text-primary">
                {totalHours.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Time Entries</div>
              <div className="mt-1 text-2xl font-semibold text-primary">
                {timeEntries.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Time Entries */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="divide-y divide-gray-200">
          {timeEntries.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No team time entries found for the selected filters
            </div>
          ) : (
            timeEntries.map((entry) => (
              <div key={entry.id} className="p-4 hover:bg-gray-50 transition-colors duration-150">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">
                        {entry.project?.name}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">
                        {entry.project?.client?.name}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      {entry.description}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {format(parseISO(entry.start_time), 'MMM d, yyyy')}
                    </div>
                    <div className="text-sm text-gray-500">
                      {format(parseISO(entry.start_time), 'HH:mm')} - {format(parseISO(entry.end_time), 'HH:mm')}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}