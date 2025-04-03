import React, { useState, useEffect } from 'react';
import { format, differenceInMinutes, isWithinInterval, startOfDay, endOfDay, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns';
import { Plus, Pencil, Trash2, Filter, X, User, DollarSign, Clock, LayoutGrid, LayoutList, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Client {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
  client_id: string;
  client: Client;
}

interface TimeEntry {
  id: string;
  project_id: string;
  start_time: string;
  end_time: string;
  description: string;
  user_id: string;
  billable: boolean;
  project: Project;
  user: {
    id: string;
    full_name: string;
    email: string;
  };
}

interface EditingEntry extends TimeEntry {
  temp_client_id?: string;
}

type ViewMode = 'list' | 'calendar';

export default function TimeEntries() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<TimeEntry[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [editingEntry, setEditingEntry] = useState<EditingEntry | null>(null);
  const [editingProjects, setEditingProjects] = useState<Project[]>([]);
  const [billableFilter, setBillableFilter] = useState<'all' | 'billable' | 'non-billable'>('all');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [manualEntry, setManualEntry] = useState({
    client_id: '',
    project_id: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '09:00',
    end_date: format(new Date(), 'yyyy-MM-dd'),
    end_time: '17:00',
    description: '',
    billable: true
  });
  const [manualEntryProjects, setManualEntryProjects] = useState<Project[]>([]);

  useEffect(() => {
    fetchClients();
    fetchEntries();
  }, []);

  useEffect(() => {
    if (selectedClient) {
      fetchProjects(selectedClient);
    } else {
      setProjects([]);
      setSelectedProject('');
    }
  }, [selectedClient]);

  useEffect(() => {
    if (editingEntry?.temp_client_id) {
      fetchProjectsForEditing(editingEntry.temp_client_id);
    }
  }, [editingEntry?.temp_client_id]);

  useEffect(() => {
    if (manualEntry.client_id) {
      fetchProjectsForManualEntry(manualEntry.client_id);
    } else {
      setManualEntryProjects([]);
      setManualEntry(prev => ({ ...prev, project_id: '' }));
    }
  }, [manualEntry.client_id]);

  useEffect(() => {
    filterEntries();
  }, [entries, selectedClient, selectedProject, startDate, endDate, billableFilter]);

  async function fetchClients() {
    const { data } = await supabase
      .from('clients')
      .select('id, name')
      .order('name');
    if (data) setClients(data);
  }

  async function fetchProjects(clientId: string) {
    const { data } = await supabase
      .from('projects')
      .select('id, name, client_id')
      .eq('client_id', clientId)
      .order('name');
    if (data) setProjects(data);
  }

  async function fetchProjectsForEditing(clientId: string) {
    const { data } = await supabase
      .from('projects')
      .select('id, name, client_id')
      .eq('client_id', clientId)
      .order('name');
    if (data) setEditingProjects(data);
  }

  async function fetchProjectsForManualEntry(clientId: string) {
    const { data } = await supabase
      .from('projects')
      .select('id, name, client_id')
      .eq('client_id', clientId)
      .order('name');
    if (data) setManualEntryProjects(data);
  }

  async function fetchEntries() {
    const { data: timeEntries } = await supabase
      .from('time_entries_with_profiles')
      .select(`
        *,
        project:projects(
          id,
          name,
          client:clients(id, name)
        )
      `)
      .order('start_time', { ascending: false });

    if (timeEntries) {
      const entriesWithProfiles = timeEntries.map(entry => ({
        ...entry,
        user: {
          id: entry.user_id,
          full_name: entry.full_name || 'Unknown User',
          email: entry.email || ''
        }
      }));
      setEntries(entriesWithProfiles);
      setFilteredEntries(entriesWithProfiles);
    }
  }

  function filterEntries() {
    let filtered = [...entries];

    if (selectedClient) {
      filtered = filtered.filter(entry => entry.project?.client?.id === selectedClient);
    }

    if (selectedProject) {
      filtered = filtered.filter(entry => entry.project?.id === selectedProject);
    }

    if (startDate && endDate) {
      filtered = filtered.filter(entry => {
        const entryDate = new Date(entry.start_time);
        return isWithinInterval(entryDate, {
          start: startOfDay(new Date(startDate)),
          end: endOfDay(new Date(endDate))
        });
      });
    }

    if (billableFilter !== 'all') {
      filtered = filtered.filter(entry => 
        billableFilter === 'billable' ? entry.billable : !entry.billable
      );
    }

    setFilteredEntries(filtered);
  }

  async function handleDelete(id: string) {
    if (confirm('Are you sure you want to delete this time entry?')) {
      const { error } = await supabase.from('time_entries').delete().eq('id', id);
      if (error) {
        alert('Error deleting time entry: ' + error.message);
        return;
      }
      fetchEntries();
    }
  }

  async function handleUpdate(entry: EditingEntry) {
    const { error } = await supabase
      .from('time_entries')
      .update({
        description: entry.description,
        start_time: entry.start_time,
        end_time: entry.end_time,
        project_id: entry.project_id,
        billable: entry.billable
      })
      .eq('id', entry.id);

    if (error) {
      alert('Error updating time entry: ' + error.message);
      return;
    }

    setEditingEntry(null);
    fetchEntries();
  }

  async function handleManualEntry(e: React.FormEvent) {
    e.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('You must be logged in to add time entries');
      return;
    }

    const startDateTime = `${manualEntry.start_date}T${manualEntry.start_time}:00`;
    const endDateTime = `${manualEntry.end_date}T${manualEntry.end_time}:00`;

    const { error } = await supabase.from('time_entries').insert({
      project_id: manualEntry.project_id,
      start_time: startDateTime,
      end_time: endDateTime,
      description: manualEntry.description,
      user_id: user.id,
      billable: manualEntry.billable
    });

    if (error) {
      alert('Error creating time entry: ' + error.message);
      return;
    }

    setShowManualEntry(false);
    setManualEntry({
      client_id: '',
      project_id: '',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      start_time: '09:00',
      end_date: format(new Date(), 'yyyy-MM-dd'),
      end_time: '17:00',
      description: '',
      billable: true
    });
    fetchEntries();
  }

  function startEditing(entry: TimeEntry) {
    setEditingEntry({
      ...entry,
      temp_client_id: entry.project?.client?.id
    });
    if (entry.project?.client?.id) {
      fetchProjectsForEditing(entry.project.client.id);
    }
  }

  function formatDuration(start: string, end: string) {
    const minutes = differenceInMinutes(new Date(end), new Date(start));
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}:${remainingMinutes.toString().padStart(2, '0')}`;
  }

  function formatDateTime(dateString: string) {
    return format(new Date(dateString), 'MMM d, yyyy h:mm a');
  }

  function clearFilters() {
    setSelectedClient('');
    setSelectedProject('');
    setStartDate('');
    setEndDate('');
    setBillableFilter('all');
  }

  const totals = filteredEntries.reduce((acc, entry) => {
    const minutes = differenceInMinutes(new Date(entry.end_time), new Date(entry.start_time));
    return {
      total: acc.total + minutes,
      billable: acc.billable + (entry.billable ? minutes : 0),
      nonBillable: acc.nonBillable + (!entry.billable ? minutes : 0)
    };
  }, { total: 0, billable: 0, nonBillable: 0 });

  function formatMinutes(minutes: number) {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  }

  function handlePrevMonth() {
    setCurrentMonth(subMonths(currentMonth, 1));
  }

  function handleNextMonth() {
    setCurrentMonth(addMonths(currentMonth, 1));
  }

  function getDaysInMonth() {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }

  function getEntriesForDay(date: Date) {
    return filteredEntries.filter(entry => 
      isSameDay(new Date(entry.start_time), date)
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Summary */}
      <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4">
        <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
          <div>
            <p className="text-xs sm:text-sm text-gray-500">Total Hours</p>
            <p className="text-lg sm:text-2xl font-semibold text-gray-900">
              {formatMinutes(totals.total)}
            </p>
          </div>
          <div>
            <p className="text-xs sm:text-sm text-gray-500">Billable Hours</p>
            <p className="text-lg sm:text-2xl font-semibold text-accent">
              {formatMinutes(totals.billable)}
            </p>
          </div>
          <div>
            <p className="text-xs sm:text-sm text-gray-500">Non-billable Hours</p>
            <p className="text-lg sm:text-2xl font-semibold text-gray-500">
              {formatMinutes(totals.nonBillable)}
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">Time Entries</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('list')}
              className={`btn py-1.5 px-2 sm:py-2 sm:px-3 ${
                viewMode === 'list'
                  ? 'btn-primary'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`btn py-1.5 px-2 sm:py-2 sm:px-3 ${
                viewMode === 'calendar'
                  ? 'btn-primary'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowManualEntry(!showManualEntry)}
              className="btn btn-primary text-xs sm:text-sm py-1.5 px-2 sm:py-2 sm:px-4"
            >
              <Plus className="w-4 h-4 mr-1 sm:mr-2" />
              Add Manual Entry
            </button>
          </div>
        </div>

        {showManualEntry && (
          <form onSubmit={handleManualEntry} className="mb-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
                <select
                  value={manualEntry.client_id}
                  onChange={(e) => setManualEntry({ ...manualEntry, client_id: e.target.value })}
                  className="w-full"
                  required
                >
                  <option value="">Select Client</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
                <select
                  value={manualEntry.project_id}
                  onChange={(e) => setManualEntry({ ...manualEntry, project_id: e.target.value })}
                  className="w-full"
                  required
                  disabled={!manualEntry.client_id}
                >
                  <option value="">Select Project</option>
                  {manualEntryProjects.map(project => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={manualEntry.start_date}
                  onChange={(e) => setManualEntry({ ...manualEntry, start_date: e.target.value })}
                  className="w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                <input
                  type="time"
                  value={manualEntry.start_time}
                  onChange={(e) => setManualEntry({ ...manualEntry, start_time: e.target.value })}
                  className="w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={manualEntry.end_date}
                  onChange={(e) => setManualEntry({ ...manualEntry, end_date: e.target.value })}
                  className="w-full"
                  required
                  min={manualEntry.start_date}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                <input
                  type="time"
                  value={manualEntry.end_time}
                  onChange={(e) => setManualEntry({ ...manualEntry, end_time: e.target.value })}
                  className="w-full"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={manualEntry.description}
                onChange={(e) => setManualEntry({ ...manualEntry, description: e.target.value })}
                className="w-full"
                rows={3}
                required
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={manualEntry.billable}
                onChange={(e) => setManualEntry({ ...manualEntry, billable: e.target.checked })}
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label className="text-sm text-gray-700">Billable Time</label>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowManualEntry(false)}
                className="btn bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Add Time Entry
              </button>
            </div>
          </form>
        )}

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="w-full rounded border-gray-300"
            >
              <option value="">All Clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full rounded border-gray-300"
              disabled={!selectedClient}
            >
              <option value="">All Projects</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded border-gray-300"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded border-gray-300"
              min={startDate}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Billable Status</label>
            <select
              value={billableFilter}
              onChange={(e) => setBillableFilter(e.target.value as 'all' | 'billable' | 'non-billable')}
              className="w-full rounded border-gray-300"
            >
              <option value="all">All Time</option>
              <option value="billable">Billable Only</option>
              <option value="non-billable">Non-billable Only</option>
            </select>
          </div>
        </div>

        {(selectedClient || selectedProject || startDate || endDate || billableFilter !== 'all') && (
          <div className="mt-3 sm:mt-4 flex justify-end">
            <button
              onClick={clearFilters}
              className="btn bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs sm:text-sm py-1.5 px-2 sm:py-2 sm:px-4"
            >
              <X className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Time Entries Display */}
      {viewMode === 'list' ? (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client/Project
                  </th>
                  <th scope="col" className="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 sm:px-6 py-4 text-center text-sm text-gray-500">
                      No time entries found
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map(entry => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                        {formatDateTime(entry.start_time)}
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm text-gray-900">
                        <div className="font-medium">{entry.project?.client?.name}</div>
                        <div className="text-gray-500">{entry.project?.name}</div>
                      </td>
                      <td className="hidden sm:table-cell px-6 py-4 text-sm text-gray-500">
                        {entry.description || '-'}
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                        {formatDuration(entry.start_time, entry.end_time)}
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-right text-xs sm:text-sm font-medium">
                        <button
                          onClick={() => startEditing(entry)}
                          className="text-primary hover:text-primary-light mr-2"
                        >
                          <Pencil className="w-3 h-3 sm:w-4 sm:h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              {format(currentMonth, 'MMMM yyyy')}
            </h3>
            <div className="flex space-x-2">
              <button
                onClick={handlePrevMonth}
                className="btn bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 p-2"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleNextMonth}
                className="btn bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 p-2"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                {day}
              </div>
            ))}
            {getDaysInMonth().map(date => {
              const dayEntries = getEntriesForDay(date);
              const totalMinutes = dayEntries.reduce((acc, entry) => 
                acc + differenceInMinutes(new Date(entry.end_time), new Date(entry.start_time)), 0
              );

              return (
                <div
                  key={date.toISOString()}
                  className={`border rounded-lg p-2 min-h-[100px] ${
                    isSameDay(date, new Date()) ? 'bg-primary/5 border-primary' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="text-right text-sm text-gray-500">
                    {format(date, 'd')}
                  </div>
                  {dayEntries.length > 0 && (
                    <div className="mt-1">
                      <div className="text-xs font-medium text-primary">
                        {formatMinutes(totalMinutes)}
                      </div>
                      <div className="mt-1 space-y-1">
                        {dayEntries.map(entry => (
                          <div
                            key={entry.id}
                            className="text-xs p-1 rounded bg-gray-50 hover:bg-gray-100 cursor-pointer"
                            onClick={() => startEditing(entry)}
                          >
                            <div className="font-medium truncate">{entry.project?.name}</div>
                            <div className="text-gray-500">
                              {format(new Date(entry.start_time), 'h:mm a')} - {format(new Date(entry.end_time), 'h:mm a')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingEntry && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Time Entry</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
                <select
                  value={editingEntry.temp_client_id || ''}
                  onChange={(e) => {
                    setEditingEntry({
                      ...editingEntry,
                      temp_client_id: e.target.value,
                      project_id: ''
                    });
                  }}
                  className="w-full rounded border-gray-300"
                >
                  <option value="">Select Client</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
                <select
                  value={editingEntry.project_id}
                  onChange={(e) => setEditingEntry({
                    ...editingEntry,
                    project_id: e.target.value
                  })}
                  className="w-full rounded border-gray-300"
                  disabled={!editingEntry.temp_client_id}
                >
                  <option value="">Select Project</option>
                  {editingProjects.map(project => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={editingEntry.description}
                  onChange={(e) => setEditingEntry({
                    ...editingEntry,
                    description: e.target.value
                  })}
                  className="w-full rounded border-gray-300"
                />
              </div>

              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={editingEntry.billable}
                    onChange={(e) => setEditingEntry({
                      ...editingEntry,
                      billable: e.target.checked
                    })}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-gray-900">Billable Time</span>
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setEditingEntry(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpdate(editingEntry)}
                className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-light rounded-md"
                disabled={!editingEntry.project_id}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}