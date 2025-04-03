import React, { useState, useEffect } from 'react';
import { format, startOfWeek, endOfWeek, subDays, startOfMonth, endOfMonth, subMonths, endOfDay, differenceInMinutes } from 'date-fns';
import { Download, Mail, Calendar, Filter, X, Clock, DollarSign, Users, PieChart, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface Client {
  id: string;
  name: string;
  email: string;
}

interface TimeEntry {
  id: string;
  project_id: string;
  start_time: string;
  end_time: string;
  description: string;
  billable: boolean;
  project: {
    name: string;
    client: Client;
  };
}

interface Report {
  clientName: string;
  clientEmail: string;
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  projects: {
    [key: string]: {
      total: number;
      billable: number;
      nonBillable: number;
    };
  };
}

type DateRange = '7days' | 'thisMonth' | 'lastMonth' | 'custom';

export default function Reports() {
  const [weeklyReport, setWeeklyReport] = useState<{ [key: string]: Report }>({});
  const [startDate, setStartDate] = useState(format(startOfWeek(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfWeek(new Date()), 'yyyy-MM-dd'));
  const [selectedRange, setSelectedRange] = useState<DateRange>('custom');
  const [emailStatus, setEmailStatus] = useState<{[key: string]: 'success' | 'error' | null}>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    fetchWeeklyReport();
  }, [startDate, endDate, selectedClient]);

  async function fetchClients() {
    const { data } = await supabase
      .from('clients')
      .select('id, name, email')
      .order('name');
    if (data) setClients(data);
  }

  const dateRanges = [
    { id: '7days', label: 'Last 7 Days', icon: Calendar },
    { id: 'thisMonth', label: 'This Month', icon: Calendar },
    { id: 'lastMonth', label: 'Last Month', icon: Calendar },
  ] as const;

  function setDateRange(range: DateRange) {
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (range) {
      case '7days':
        start = subDays(now, 6);
        end = endOfDay(now);
        break;
      case 'thisMonth':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case 'lastMonth':
        const lastMonth = subMonths(now, 1);
        start = startOfMonth(lastMonth);
        end = endOfMonth(lastMonth);
        break;
      default:
        return;
    }

    setSelectedRange(range);
    setStartDate(format(start, 'yyyy-MM-dd'));
    setEndDate(format(end, 'yyyy-MM-dd'));
  }

  function formatDuration(minutes: number) {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  }

  async function fetchWeeklyReport() {
    setLoading(true);
    
    try {
      // Build the base query
      let query = supabase
        .from('time_entries')
        .select(`
          *,
          project:projects!inner(
            id,
            name,
            client:clients!inner(
              id,
              name,
              email
            )
          )
        `)
        .gte('start_time', `${startDate}T00:00:00`)
        .lte('end_time', `${endDate}T23:59:59`);

      // Add client filter if selected
      if (selectedClient) {
        query = query.eq('project.client.id', selectedClient);
      }

      const { data: entries, error } = await query;

      if (error) {
        console.error('Error fetching time entries:', error);
        setWeeklyReport({});
        setLoading(false);
        return;
      }

      if (!entries || entries.length === 0) {
        setWeeklyReport({});
        setLoading(false);
        return;
      }

      const report: { [key: string]: Report } = {};

      entries.forEach((entry: TimeEntry) => {
        // Skip entries without valid client relationship
        if (!entry.project?.client) return;

        const clientName = entry.project.client.name;
        const clientEmail = entry.project.client.email;
        const projectName = entry.project.name;
        const minutes = differenceInMinutes(new Date(entry.end_time), new Date(entry.start_time));

        if (!report[clientName]) {
          report[clientName] = {
            clientName,
            clientEmail,
            totalHours: 0,
            billableHours: 0,
            nonBillableHours: 0,
            projects: {},
          };
        }

        if (!report[clientName].projects[projectName]) {
          report[clientName].projects[projectName] = {
            total: 0,
            billable: 0,
            nonBillable: 0
          };
        }

        report[clientName].totalHours += minutes;
        report[clientName].projects[projectName].total += minutes;

        if (entry.billable) {
          report[clientName].billableHours += minutes;
          report[clientName].projects[projectName].billable += minutes;
        } else {
          report[clientName].nonBillableHours += minutes;
          report[clientName].projects[projectName].nonBillable += minutes;
        }
      });

      setWeeklyReport(report);
    } catch (error) {
      console.error('Error processing time entries:', error);
      setWeeklyReport({});
    } finally {
      setLoading(false);
    }
  }

  async function sendEmailReport(report: Report) {
    if (!report.clientEmail) {
      setErrorMessage(`No email address found for ${report.clientName}`);
      return;
    }

    try {
      const subject = `Time Report (${format(new Date(startDate), 'MMM d')} - ${format(new Date(endDate), 'MMM d, yyyy')})`;

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
          to: report.clientEmail,
          subject,
          report: {
            ...report,
            startDate,
            endDate,
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send report');
      }

      setEmailStatus(prev => ({ ...prev, [report.clientName]: 'success' }));
    } catch (error) {
      console.error(`Error sending report for ${report.clientName}:`, error);
      setEmailStatus(prev => ({ ...prev, [report.clientName]: 'error' }));
      setErrorMessage(error instanceof Error ? error.message : 'An unknown error occurred');
    }
  }

  function downloadCSV() {
    let csv = `TimeFlow Report\n`;
    csv += `Report Period: ${format(new Date(startDate), 'MMMM d, yyyy')} to ${format(new Date(endDate), 'MMMM d, yyyy')}\n\n`;
    
    if (selectedClient) {
      const clientName = clients.find(c => c.id === selectedClient)?.name;
      csv += `Filtered by Client: ${clientName}\n\n`;
    }
    
    Object.values(weeklyReport).forEach((client) => {
      csv += `Client: ${client.clientName}\n`;
      csv += `Email: ${client.clientEmail}\n`;
      csv += `Total Hours: ${formatDuration(client.totalHours)}\n`;
      csv += `Billable Hours: ${formatDuration(client.billableHours)}\n`;
      csv += `Non-billable Hours: ${formatDuration(client.nonBillableHours)}\n\n`;
      
      csv += 'Project,Total Hours,Billable Hours,Non-billable Hours\n';
      Object.entries(client.projects)
        .sort(([aName], [bName]) => aName.localeCompare(bName))
        .forEach(([project, hours]) => {
          csv += `${project},${formatDuration(hours.total)},${formatDuration(hours.billable)},${formatDuration(hours.nonBillable)}\n`;
        });
      
      csv += '\n';
    });

    if (Object.keys(weeklyReport).length > 1) {
      const totals = Object.values(weeklyReport).reduce((sum, client) => ({
        total: sum.total + client.totalHours,
        billable: sum.billable + client.billableHours,
        nonBillable: sum.nonBillable + client.nonBillableHours
      }), { total: 0, billable: 0, nonBillable: 0 });

      csv += `\nTotal Hours Across All Clients: ${formatDuration(totals.total)}\n`;
      csv += `Total Billable Hours: ${formatDuration(totals.billable)}\n`;
      csv += `Total Non-billable Hours: ${formatDuration(totals.nonBillable)}\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    const fileName = `timeflow-report-${startDate}-to-${endDate}${selectedClient ? '-filtered' : ''}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function downloadPDF(report: Report) {
    // Create PDF document
    const doc = new jsPDF();
    
    // Add logo and title
    doc.setFontSize(20);
    doc.setTextColor(37, 99, 235); // Blue color
    doc.text('Time Report', 20, 20);
    
    // Add client info
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(`Client: ${report.clientName}`, 20, 35);
    doc.text(`Period: ${format(new Date(startDate), 'MMMM d, yyyy')} - ${format(new Date(endDate), 'MMMM d, yyyy')}`, 20, 45);
    
    // Add summary
    doc.setFontSize(12);
    doc.text(`Total Hours: ${(report.totalHours / 60).toFixed(2)}`, 20, 60);
    doc.text(`Billable Hours: ${(report.billableHours / 60).toFixed(2)}`, 20, 70);
    doc.text(`Non-billable Hours: ${(report.nonBillableHours / 60).toFixed(2)}`, 20, 80);
    
    // Add project breakdown table
    const tableData = Object.entries(report.projects).map(([project, hours]) => [
      project,
      (hours.total / 60).toFixed(2),
      (hours.billable / 60).toFixed(2),
      (hours.nonBillable / 60).toFixed(2)
    ]);
    
    // Add table with styling
    doc.autoTable({
      startY: 90,
      head: [['Project', 'Total Hours', 'Billable Hours', 'Non-billable Hours']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: 255,
        fontSize: 10,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 10
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250]
      },
      margin: { top: 20 }
    });

    // Save the PDF
    doc.save(`${report.clientName}-time-report.pdf`);
  }

  function clearFilters() {
    setSelectedClient('');
    setStartDate(format(startOfWeek(new Date()), 'yyyy-MM-dd'));
    setEndDate(format(endOfWeek(new Date()), 'yyyy-MM-dd'));
    setSelectedRange('custom');
  }

  const totals = Object.values(weeklyReport).reduce((sum, client) => ({
    total: sum.total + client.totalHours,
    billable: sum.billable + client.billableHours,
    nonBillable: sum.nonBillable + client.nonBillableHours
  }), { total: 0, billable: 0, nonBillable: 0 });

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl shadow-lg overflow-hidden">
        <div className="p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="bg-primary/10 rounded-lg p-2">
                <PieChart className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Time Reports</h1>
                <p className="text-sm text-gray-600">View and analyze time entries</p>
              </div>
            </div>
            <div className="flex space-x-2">
              <button 
                onClick={downloadCSV} 
                className="btn btn-primary py-2 px-4 text-base"
              >
                <Download className="w-5 h-5 mr-2" />
                Download CSV
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="bg-blue-50 rounded-lg p-2">
                  <Clock className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Hours</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {formatDuration(totals.total)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="bg-green-50 rounded-lg p-2">
                  <DollarSign className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Billable Hours</p>
                  <p className="text-2xl font-semibold text-green-600">
                    {formatDuration(totals.billable)}
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
                  <p className="text-sm text-gray-500">Non-billable Hours</p>
                  <p className="text-2xl font-semibold text-gray-500">
                    {formatDuration(totals.nonBillable)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="bg-purple-50 rounded-lg p-2">
                  <Users className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Active Clients</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {Object.keys(weeklyReport).length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Filter className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-gray-800">Filters</h2>
            </div>
            {(selectedClient || selectedRange !== 'custom') && (
              <button
                onClick={clearFilters}
                className="btn bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 py-2 px-4 text-base"
              >
                <X className="w-4 h-4 mr-2" />
                Clear Filters
              </button>
            )}
          </div>

          <div className="space-y-6">
            <div className="flex flex-wrap gap-3">
              {dateRanges.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setDateRange(id)}
                  className={`btn py-2 px-4 text-base ${
                    selectedRange === id
                      ? 'btn-primary'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client
                </label>
                <select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className="w-full"
                >
                  <option value="">All Clients</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
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
                  onChange={(e) => {
                    setSelectedRange('custom');
                    setStartDate(e.target.value);
                  }}
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
                  onChange={(e) => {
                    setSelectedRange('custom');
                    setEndDate(e.target.value);
                  }}
                  className="w-full"
                  min={startDate}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {loading ? (
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-3 text-gray-600">Loading reports...</span>
            </div>
          </div>
        ) : Object.values(weeklyReport).length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              No time entries found for the selected period
              {selectedClient && ' and client'}
            </p>
          </div>
        ) : (
          Object.values(weeklyReport).map((client) => (
            <div key={client.clientName} className="bg-white rounded-xl shadow-lg border border-gray-100">
              <div className="p-6 border-b border-gray-100">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      {client.clientName}
                    </h3>
                    <p className="text-sm text-gray-500">{client.clientEmail}</p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => downloadPDF(client)}
                      className="btn bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 py-2 px-4 text-base"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      PDF
                    </button>
                    <button
                      onClick={() => sendEmailReport(client)}
                      className="btn bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 py-2 px-4 text-base"
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Send Report
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div>
                    <span className="text-sm font-medium text-gray-500">Total Hours</span>
                    <div className="mt-1 text-2xl font-semibold text-gray-900">
                      {formatDuration(client.totalHours)}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500 flex items-center">
                      <DollarSign className="w-4 h-4 mr-1 text-green-500" />
                      Billable Hours
                    </span>
                    <div className="mt-1 text-2xl font-semibold text-green-600">
                      {formatDuration(client.billableHours)}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500 flex items-center">
                      <Clock className="w-4 h-4 mr-1 text-gray-500" />
                      Non-billable Hours
                    </span>
                    <div className="mt-1 text-2xl font-semibold text-gray-500">
                      {formatDuration(client.nonBillableHours)}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {Object.entries(client.projects).map(([project, hours]) => (
                    <div
                      key={project}
                      className="flex justify-between items-center text-sm py-2 border-b border-gray-200 last:border-0"
                    >
                      <span className="text-gray-700">{project}</span>
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center text-green-600">
                          <DollarSign className="w-4 h-4 mr-1" />
                          <span className="font-medium">{formatDuration(hours.billable)}</span>
                        </div>
                        <div className="flex items-center text-gray-500">
                          <Clock className="w-4 h-4 mr-1" />
                          <span className="font-medium">{formatDuration(hours.nonBillable)}</span>
                        </div>
                        <div className="w-20 text-right font-medium text-gray-900">
                          {formatDuration(hours.total)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}