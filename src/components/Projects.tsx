import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
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

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
    fetchClients();
  }, []);

  async function fetchProjects() {
    const { data } = await supabase
      .from('projects')
      .select(`
        *,
        client:clients(id, name)
      `)
      .order('name');
    if (data) setProjects(data);
  }

  async function fetchClients() {
    const { data } = await supabase.from('clients').select('id, name').order('name');
    if (data) setClients(data);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      alert('You must be logged in to manage projects');
      return;
    }

    if (editingId) {
      const { error } = await supabase
        .from('projects')
        .update({ name, client_id: clientId })
        .eq('id', editingId);

      if (error) {
        alert('Error updating project: ' + error.message);
        return;
      }
    } else {
      const { error } = await supabase
        .from('projects')
        .insert({ 
          name, 
          client_id: clientId,
          user_id: user.id
        });

      if (error) {
        alert('Error creating project: ' + error.message);
        return;
      }
    }

    setName('');
    setClientId('');
    setEditingId(null);
    fetchProjects();
  }

  async function handleDelete(id: string) {
    if (confirm('Are you sure you want to delete this project?')) {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) {
        alert('Error deleting project: ' + error.message);
        return;
      }
      fetchProjects();
    }
  }

  function handleEdit(project: Project) {
    setName(project.name);
    setClientId(project.client_id);
    setEditingId(project.id);
  }

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-800">
            {editingId ? 'Edit Project' : 'Add New Project'}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Create a new project or edit an existing one
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="project-name" className="block text-sm font-medium text-gray-700">
                Project Name
              </label>
              <input
                id="project-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter project name"
                className="w-full"
                required
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="client" className="block text-sm font-medium text-gray-700">
                Client
              </label>
              <select
                id="client"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full"
                required
              >
                <option value="">Select a client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <button type="submit" className="btn btn-primary">
              <Plus className="w-5 h-5 mr-2" />
              {editingId ? 'Update Project' : 'Add Project'}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Project Name</th>
                <th>Client</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id}>
                  <td className="font-medium text-gray-900">{project.name}</td>
                  <td>{project.client?.name}</td>
                  <td className="text-right">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => handleEdit(project)}
                        className="text-primary hover:text-primary-light transition-colors"
                        title="Edit project"
                      >
                        <Pencil className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(project.id)}
                        className="text-red-500 hover:text-red-600 transition-colors"
                        title="Delete project"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center text-gray-500 py-8">
                    No projects found. Create your first project above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}