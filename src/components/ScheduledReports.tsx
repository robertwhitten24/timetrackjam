import React, { useState, useEffect } from 'react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { supabase } from '../lib/supabase';
import { Bell, Calendar, Clock, Mail, Plus, Trash2, Users, Play, Settings } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  email: string;
}

interface ScheduledReport {
  id: string;
  name: string;
  client_id: string;
  frequency: 'weekly' | 'monthly' | 'both';
  send_time: string;
  recipient_email: string;
  last_sent: string | null;
  next_send: string;
  client?: {
    name: string;
  };
}

export default function ScheduledReports() {
  const [clients, setClients] = useState<Client[]>([]);
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [reportName, setReportName] = useState('');
  const [frequency, setFrequency] = useState<'weekly' | 'monthly' | 'both'>('weekly');
  const [sendTime, setSendTime] = useState('17:00');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchClients();
    fetchReports();
  }, []);

  async function fetchClients() {
    const { data } = await supabase
      .from('clients')
      .select('id, name, email')
      .order('name');
    if (data) setClients(data);
  }

  async function fetchReports() {
    const { data } = await supabase
      .from('scheduled_reports')
      .select(`
        *,
        client:clients(name)
      `)
      .order('created_at', { ascending: false });
    if (data) setReports(data);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('You must be logged in to create scheduled reports');
      return;
    }

    let repeat_days: number[];
    switch (frequency) {
      case 'weekly':
        repeat_days = [0];
        break;
      case 'monthly':
        repeat_days = [-1];
        break;
      case 'both':
        repeat_days = [0, -1];
        break;
      default:
        repeat_days = [0];
    }

    const { error } = await supabase
      .from('scheduled_reports')
      .insert({
        user_id: user.id,
        client_id: selectedClient,
        name: reportName,
        frequency,
        send_time: sendTime,
        recipient_email: recipientEmail,
        repeat_days
      });

    if (error) {
      alert('Error creating scheduled report: ' + error.message);
      return;
    }

    setSelectedClient('');
    setReportName('');
    setFrequency('weekly');
    setSendTime('17:00');
    setRecipientEmail('');
    setShowForm(false);

    fetchReports();
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this scheduled report?')) return;

    const { error } = await supabase
      .from('scheduled_reports')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Error deleting report: ' + error.message);
      return;
    }

    fetchReports();
  }

  async function handleTestReport(report: ScheduledReport) {
    setLoading(prev => ({ ...prev, [report.id]: true }));

    try {
      const startDate = format(startOfWeek(new Date()), 'yyyy-MM-dd');
      const endDate = format(endOfWeek(new Date()), 'yyyy-MM-dd');

      const { data: entries } = await supabase
        .from('time_entries')
        .select(`
          *,
          project:projects(
            id,
            name,
            client:clients(id, name, email)
          )
        `)
        .eq('project.client_id', report.client_id)
        .gte('start_time', `${startDate}T00:00:00`)
        .lte('end_time', `${endDate}T23:59:59`);

      if (!entries || entries.length === 0) {
        alert('No time entries found for this period');
        return;
      }

      // Process entries into report format
      const reportData = {
        clientName: report.client?.name || 'Unknown Client',
        clientEmail: report.recipient_email,
        totalHours: 0,
        billableHours: 0,
        nonBillableHours: 0,
        projects: {} as Record<string, { total: number; billable: number; nonBillable: number }>,
      };

      entries.forEach((entry: any) => {
        const projectName = entry.project?.name || 'Unassigned';
        const minutes = (new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / 1000 / 60;

        if (!reportData.projects[projectName]) {
          reportData.projects[projectName] = {
            total: 0,
            billable: 0,
            nonBillable: 0,
          };
        }

        reportData.totalHours += minutes;
        reportData.projects[projectName].total += minutes;

        if (entry.billable) {
          reportData.billableHours += minutes;
          reportData.projects[projectName].billable += minutes;
        } else {
          reportData.nonBillableHours += minutes;
          reportData.projects[projectName].nonBillable += minutes;
        }
      });

      // Convert minutes to hours
      reportData.totalHours /= 60;
      reportData.billableHours /= 60;
      reportData.nonBillableHours /= 60;
      Object.values(reportData.projects).forEach(project => {
        project.total /= 60;
        project.billable /= 60;
        project.nonBillable /= 60;
      });

      const subject = `${report.name} - Time Report (${format(new Date(startDate), 'MMM d')} - ${format(new Date(endDate), 'MMM d, yyyy')})`;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-report`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: report.recipient_email,
          subject,
          report: {
            ...reportData,
            startDate,
            endDate,
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send test report');
      }

      alert('Test report sent successfully!');
    } catch (error) {
      console.error('Error sending test report:', error);
      alert('Error sending test report: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(prev => ({ ...prev, [report.id]: false }));
    }
  }

  function getFrequencyLabel(freq: string): string {
    switch (freq) {
      case 'weekly':
        return 'Every Sunday';
      case 'monthly':
        return 'End of every month';
      case 'both':
        return 'Every Sunday and end of month';
      default:
        return freq;
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl shadow-lg overflow-hidden">
        <div className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
            <div className="flex items-center space-x-3 mb-4 sm:mb-0">
              <div className="bg-primary/10 rounded-lg p-2">
                <Bell className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Scheduled Reports</h1>
                <p className="text-sm text-gray-600">Automate your client reporting</p>
              </div>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="btn btn-primary shadow-lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              New Schedule
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="bg-blue-50 rounded-lg p-2">
                  <Bell className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Reports</p>
                  <p className="text-2xl font-semibold text-gray-900">{reports.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="bg-green-50 rounded-lg p-2">
                  <Users className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Active Clients</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {new Set(reports.map(r => r.client_id)).size}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="bg-purple-50 rounded-lg p-2">
                  <Calendar className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Weekly Reports</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {reports.filter(r => r.frequency === 'weekly' || r.frequency === 'both').length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="bg-orange-50 rounded-lg p-2">
                  <Clock className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Monthly Reports</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {reports.filter(r => r.frequency === 'monthly' || r.frequency === 'both').length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add New Report Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <Settings className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-semibold text-gray-800">Report Settings</h2>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Report Name
                  </label>
                  <input
                    type="text"
                    value={reportName}
                    onChange={(e) => setReportName(e.target.value)}
                    className="w-full"
                    placeholder="Client Time Report"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Client
                  </label>
                  <select
                    value={selectedClient}
                    onChange={(e) => {
                      setSelectedClient(e.target.value);
                      const client = clients.find(c => c.id === e.target.value);
                      if (client) setRecipientEmail(client.email);
                    }}
                    className="w-full"
                    required
                  >
                    <option value="">Select Client</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Frequency
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as 'weekly' | 'monthly' | 'both')}
                    className="w-full"
                    required
                  >
                    <option value="weekly">Weekly (Every Sunday)</option>
                    <option value="monthly">Monthly (End of Month)</option>
                    <option value="both">Both (Weekly & Monthly)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Send Time
                  </label>
                  <input
                    type="time"
                    value={sendTime}
                    onChange={(e) => setSendTime(e.target.value)}
                    className="w-full"
                    required
                  />
                </div>

                <div className="md:col-span-2 space-y-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Recipient Email
                  </label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="w-full"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <Plus className="w-5 h-5 mr-2" />
                  Schedule Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Scheduled Reports List */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-medium text-gray-900">Active Schedules</h3>
        </div>

        <div className="divide-y divide-gray-100">
          {reports.length === 0 ? (
            <div className="p-6 text-center">
              <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No scheduled reports yet.</p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 btn btn-primary"
              >
                <Plus className="w-5 h-5 mr-2" />
                Create Your First Schedule
              </button>
            </div>
          ) : (
            reports.map((report) => (
              <div key={report.id} className="p-6 hover:bg-gray-50 transition-colors duration-200">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h4 className="text-lg font-medium text-gray-900">{report.name}</h4>
                    <p className="text-sm text-gray-500">
                      {report.client?.name}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleTestReport(report)}
                      disabled={loading[report.id]}
                      className="btn bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
                      title="Send test report"
                    >
                      <Play className={`w-4 h-4 ${loading[report.id] ? 'animate-pulse' : ''}`} />
                      <span className="ml-2">Test</span>
                    </button>
                    <button
                      onClick={() => handleDelete(report.id)}
                      className="btn bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                      title="Delete schedule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="flex items-center space-x-2 text-gray-600">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">{getFrequencyLabel(report.frequency)}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-gray-600">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">{format(new Date(`2000-01-01T${report.send_time}`), 'h:mm a')}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-gray-600">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">{report.recipient_email}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-gray-600">
                    <Bell className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">
                      Next: {format(new Date(report.next_send), 'MMM d, h:mm a')}
                    </span>
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