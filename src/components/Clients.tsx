import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, DollarSign, Clock, Users, Building2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Client {
  id: string;
  name: string;
  email: string;
  hourly_rate: number;
  is_retainer: boolean;
  retainer_amount: number;
  retainer_hours: number;
}

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [hourlyRate, setHourlyRate] = useState('0');
  const [isRetainer, setIsRetainer] = useState(false);
  const [retainerAmount, setRetainerAmount] = useState('0');
  const [retainerHours, setRetainerHours] = useState('0');
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    const { data } = await supabase.from('clients').select('*').order('name');
    if (data) setClients(data);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      alert('You must be logged in to manage clients');
      return;
    }

    const clientData = {
      name,
      email,
      hourly_rate: parseFloat(hourlyRate) || 0,
      is_retainer: isRetainer,
      retainer_amount: isRetainer ? parseFloat(retainerAmount) || 0 : 0,
      retainer_hours: isRetainer ? parseFloat(retainerHours) || 0 : 0,
      user_id: user.id
    };

    if (editingId) {
      const { error } = await supabase
        .from('clients')
        .update(clientData)
        .eq('id', editingId);

      if (error) {
        alert('Error updating client: ' + error.message);
        return;
      }
    } else {
      const { error } = await supabase
        .from('clients')
        .insert(clientData);

      if (error) {
        alert('Error creating client: ' + error.message);
        return;
      }
    }

    setName('');
    setEmail('');
    setHourlyRate('0');
    setIsRetainer(false);
    setRetainerAmount('0');
    setRetainerHours('0');
    setEditingId(null);
    fetchClients();
  }

  async function handleDelete(id: string) {
    if (confirm('Are you sure you want to delete this client?')) {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) {
        alert('Error deleting client: ' + error.message);
        return;
      }
      fetchClients();
    }
  }

  function handleEdit(client: Client) {
    setName(client.name);
    setEmail(client.email);
    setHourlyRate(client.hourly_rate.toString());
    setIsRetainer(client.is_retainer);
    setRetainerAmount(client.retainer_amount.toString());
    setRetainerHours(client.retainer_hours.toString());
    setEditingId(client.id);
  }

  async function handleRetainerToggle(client: Client) {
    const { error } = await supabase
      .from('clients')
      .update({ 
        is_retainer: !client.is_retainer,
        retainer_amount: !client.is_retainer ? client.retainer_amount : 0,
        retainer_hours: !client.is_retainer ? client.retainer_hours : 0
      })
      .eq('id', client.id);

    if (error) {
      alert('Error updating client: ' + error.message);
      return;
    }

    fetchClients();
  }

  return (
    <div className="space-y-6">
      {/* Add/Edit Client Form */}
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center space-x-3 mb-6">
            <Building2 className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold text-gray-800">
              {editingId ? 'Edit Client' : 'Add New Client'}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Basic Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Client Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pr-10 pl-4"
                      placeholder="Enter client name"
                      required
                    />
                    <Users className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pr-10 pl-4"
                      placeholder="client@example.com"
                      required
                    />
                    <Users className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* Billing Information */}
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Billing Information</h3>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isRetainer}
                      onChange={(e) => setIsRetainer(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/25 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    <span className="ms-3 text-sm font-medium text-gray-700">Retainer Client</span>
                  </label>
                </div>

                {!isRetainer && (
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hourly Rate (£)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={hourlyRate}
                        onChange={(e) => setHourlyRate(e.target.value)}
                        className="w-full pr-10 pl-4"
                        placeholder="0.00"
                      />
                      <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                )}

                {isRetainer && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Monthly Retainer Amount (£)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={retainerAmount}
                          onChange={(e) => setRetainerAmount(e.target.value)}
                          className="w-full pr-10 pl-4"
                          placeholder="0.00"
                          required={isRetainer}
                        />
                        <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Monthly Retainer Hours
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={retainerHours}
                          onChange={(e) => setRetainerHours(e.target.value)}
                          className="w-full pr-10 pl-4"
                          placeholder="0.0"
                          required={isRetainer}
                        />
                        <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button type="submit" className="btn btn-primary">
                <Plus className="w-5 h-5 mr-2" />
                {editingId ? 'Update Client' : 'Add Client'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Clients List */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">Clients</h2>
            <span className="text-sm text-gray-500">{clients.length} total</span>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {clients.map((client) => (
            <div
              key={client.id}
              className="p-4 sm:p-6 hover:bg-gray-50 transition-colors duration-150"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h3 className="text-lg font-medium text-gray-900">{client.name}</h3>
                  <p className="text-sm text-gray-500">{client.email}</p>
                </div>
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => handleEdit(client)}
                    className="text-gray-400 hover:text-primary transition-colors"
                    title="Edit client"
                  >
                    <Pencil className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(client.id)}
                    className="text-gray-400 hover:text-red-600 transition-colors"
                    title="Delete client"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="mt-4 flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {client.is_retainer
                      ? `£${client.retainer_amount.toFixed(2)}/month`
                      : `£${client.hourly_rate.toFixed(2)}/hour`}
                  </span>
                </div>
                {client.is_retainer && (
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      {client.retainer_hours} hours/month
                    </span>
                  </div>
                )}
                <div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={client.is_retainer}
                      onChange={() => handleRetainerToggle(client)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/25 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    <span className="ms-2 text-sm text-gray-600">
                      {client.is_retainer ? 'Retainer' : 'Hourly'}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          ))}

          {clients.length === 0 && (
            <div className="p-6 text-center text-gray-500">
              No clients yet. Add your first client above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}