import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Plus, Search, Clock, FolderKanban, Pause, Users, FileText, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { timerDB } from '../lib/db';
import type { Project, Client } from '../lib/types';

// Create Worker
const worker = new Worker(new URL('../lib/timerWorker.ts', import.meta.url), { type: 'module' });

export default function Timer() {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [description, setDescription] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [clientInput, setClientInput] = useState('');
  const [projectInput, setProjectInput] = useState('');
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [showProjectSuggestions, setShowProjectSuggestions] = useState(false);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [isBillable, setIsBillable] = useState(true);
  const clientSuggestionsRef = useRef<HTMLDivElement>(null);
  const projectSuggestionsRef = useRef<HTMLDivElement>(null);
  const baseTimeRef = useRef(0);
  const originalTitle = useRef(document.title);
  const clientInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Initialize timer state from storage
    async function initTimer() {
      const savedState = await timerDB.getTimer();
      if (savedState && savedState.isRunning) {
        setIsRunning(true);
        setIsPaused(savedState.isPaused);
        setStartTime(savedState.startTime ? new Date(savedState.startTime) : null);
        setElapsedTime(savedState.elapsedTime);
        setDescription(savedState.description);
        setSelectedClient(savedState.selectedClient);
        setSelectedProject(savedState.selectedProject);
        setClientInput(savedState.selectedClient?.name || '');
        setProjectInput(savedState.selectedProject?.name || '');
        setIsBillable(savedState.isBillable);
        baseTimeRef.current = savedState.baseTime || 0;

        if (!savedState.isPaused && savedState.startTime) {
          worker.postMessage({
            type: 'START',
            payload: { startTime: savedState.startTime }
          });
        }
      }
    }

    initTimer();
    fetchClients();

    // Set up worker message handler
    worker.onmessage = (e: MessageEvent) => {
      const { type, elapsed } = e.data;
      if (type === 'TICK') {
        setElapsedTime(elapsed);
        updatePageTitle(elapsed);
      }
    };

    // Set up visibility change handler
    const handleVisibility = () => {
      if (!document.hidden && isRunning && !isPaused) {
        worker.postMessage({ type: 'SYNC' });
      }
      // Hide dropdowns when switching tabs
      setShowClientSuggestions(false);
      setShowProjectSuggestions(false);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('mousedown', handleClickOutside);
      worker.postMessage({ type: 'STOP' });
      document.title = originalTitle.current;
    };
  }, []);

  useEffect(() => {
    if (selectedClient) {
      fetchProjects(selectedClient.id);
    } else {
      setProjects([]);
      setSelectedProject(null);
      setProjectInput('');
    }
  }, [selectedClient]);

  useEffect(() => {
    if (clientInput) {
      const filtered = clients.filter(client =>
        client.name.toLowerCase().includes(clientInput.toLowerCase())
      );
      setFilteredClients(filtered);
    } else {
      setFilteredClients([]);
    }
  }, [clientInput, clients]);

  useEffect(() => {
    if (projectInput) {
      const filtered = projects.filter(project =>
        project.name.toLowerCase().includes(projectInput.toLowerCase())
      );
      setFilteredProjects(filtered);
    } else {
      setFilteredProjects([]);
    }
  }, [projectInput, projects]);

  function handleClickOutside(event: MouseEvent) {
    if (clientSuggestionsRef.current && !clientSuggestionsRef.current.contains(event.target as Node) &&
        clientInputRef.current && !clientInputRef.current.contains(event.target as Node)) {
      setShowClientSuggestions(false);
    }
    if (projectSuggestionsRef.current && !projectSuggestionsRef.current.contains(event.target as Node) &&
        projectInputRef.current && !projectInputRef.current.contains(event.target as Node)) {
      setShowProjectSuggestions(false);
    }
  }

  async function fetchClients() {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .order('name');
    if (data) setClients(data);
  }

  async function fetchProjects(clientId: string) {
    if (!clientId) {
      setProjects([]);
      setSelectedProject(null);
      return;
    }

    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('client_id', clientId)
      .order('name');
    
    if (data) {
      setProjects(data);
    }
  }

  async function handleCreateClient(e: React.FormEvent) {
    e.preventDefault();
    
    if (!clientInput.trim()) {
      alert('Please enter a client name');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      alert('You must be logged in to create clients');
      return;
    }

    const { data, error } = await supabase
      .from('clients')
      .insert({ 
        name: clientInput.trim(),
        email: '',
        user_id: user.id
      })
      .select()
      .single();

    if (error) {
      alert('Error creating client: ' + error.message);
      return;
    }

    if (data) {
      setClients([...clients, data]);
      setSelectedClient(data);
      setClientInput(data.name);
      setShowClientSuggestions(false);
    }
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    
    if (!selectedClient || !projectInput.trim()) {
      alert('Please select a client and enter a project name');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      alert('You must be logged in to create projects');
      return;
    }

    const { data, error } = await supabase
      .from('projects')
      .insert({ 
        name: projectInput.trim(), 
        client_id: selectedClient.id,
        user_id: user.id
      })
      .select()
      .single();

    if (error) {
      alert('Error creating project: ' + error.message);
      return;
    }

    if (data) {
      setProjects([...projects, data]);
      setSelectedProject(data);
      setProjectInput(data.name);
      setShowProjectSuggestions(false);
    }
  }

  async function handleStart() {
    if (!selectedProject) {
      alert('Please select a project');
      return;
    }

    const now = new Date();
    setStartTime(now);
    setIsRunning(true);
    setIsPaused(false);
    baseTimeRef.current = 0;

    worker.postMessage({
      type: 'START',
      payload: { startTime: now.getTime() }
    });

    await timerDB.saveTimer({
      isRunning: true,
      isPaused: false,
      startTime: now.getTime(),
      elapsedTime: 0,
      baseTime: 0,
      description,
      selectedClient,
      selectedProject,
      isBillable
    });
  }

  async function handlePause() {
    if (isPaused) {
      // Resuming
      const now = new Date();
      const newStartTime = new Date(now.getTime() - elapsedTime);
      setStartTime(newStartTime);
      setIsPaused(false);

      worker.postMessage({
        type: 'RESUME',
        payload: { startTime: newStartTime.getTime() }
      });
    } else {
      // Pausing
      setIsPaused(true);
      baseTimeRef.current = elapsedTime;
      worker.postMessage({ type: 'PAUSE' });
    }

    await timerDB.saveTimer({
      isRunning,
      isPaused: !isPaused,
      startTime: startTime?.getTime() || null,
      elapsedTime,
      baseTime: baseTimeRef.current,
      description,
      selectedClient,
      selectedProject,
      isBillable
    });
  }

  async function handleStop() {
    if (!startTime || !selectedProject) return;

    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      alert('You must be logged in to track time');
      return;
    }

    const endTime = new Date();
    
    const { error } = await supabase.from('time_entries').insert({
      project_id: selectedProject.id,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      description,
      user_id: user.id,
      billable: isBillable
    });

    if (error) {
      alert('Error saving time entry: ' + error.message);
      return;
    }

    setIsRunning(false);
    setIsPaused(false);
    setStartTime(null);
    setElapsedTime(0);
    setDescription('');
    baseTimeRef.current = 0;
    worker.postMessage({ type: 'STOP' });
    document.title = originalTitle.current;
    await timerDB.clearTimer();
  }

  function updatePageTitle(elapsed: number) {
    const projectName = selectedProject?.name || 'Timer';
    document.title = `${formatTime(elapsed)} - ${projectName}`;
  }

  function formatTime(ms: number) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / 1000 / 60) % 60);
    const hours = Math.floor(ms / 1000 / 60 / 60);

    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  function handleClientSelect(client: Client) {
    setSelectedClient(client);
    setClientInput(client.name);
    setShowClientSuggestions(false);
    // Clear project selection when client changes
    setSelectedProject(null);
    setProjectInput('');
  }

  function handleProjectSelect(project: Project) {
    setSelectedProject(project);
    setProjectInput(project.name);
    setShowProjectSuggestions(false);
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="timer-container">
        {/* Timer Display */}
        <div className="timer-display flex items-center justify-center p-6 sm:p-12">
          <div className="flex items-center space-x-4 sm:space-x-8">
            <div className="relative">
              <Clock className="w-8 h-8 sm:w-12 sm:h-12 text-white" />
              <div 
                className="absolute -top-1 -right-1 w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-accent animate-pulse" 
                style={{ display: isRunning && !isPaused ? 'block' : 'none' }}
              />
            </div>
            <div className="timer-digits text-4xl sm:text-7xl">
              {formatTime(elapsedTime)}
            </div>
          </div>
        </div>

        {/* Form Fields */}
        <div className="p-4 sm:p-6 space-y-4">
          {/* Client Selection */}
          <div className="form-field">
            <div className="form-field-header">
              <Users className="form-field-icon" />
              <label className="form-field-title">Client</label>
            </div>
            <div className="relative">
              <input
                ref={clientInputRef}
                type="text"
                value={clientInput}
                onChange={(e) => setClientInput(e.target.value)}
                onFocus={() => !isRunning && setShowClientSuggestions(true)}
                placeholder="Search or create client..."
                className="w-full pr-10 py-2 sm:py-3 text-sm rounded-lg bg-gray-50 border border-gray-200 focus:border-primary focus:ring-primary placeholder:text-gray-400"
                disabled={isRunning}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <Search className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
              </div>
              
              {showClientSuggestions && (
                <div 
                  ref={clientSuggestionsRef}
                  className="absolute z-20 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-100 max-h-60 overflow-auto top-full"
                >
                  {filteredClients.length > 0 ? (
                    <ul className="py-1">
                      {filteredClients.map((client) => (
                        <li
                          key={client.id}
                          onClick={() => handleClientSelect(client)}
                          className="px-4 py-3 hover:bg-gray-50 cursor-pointer text-sm transition-colors duration-150 flex items-center"
                        >
                          <Users className="w-4 h-4 text-gray-400 mr-2" />
                          {client.name}
                        </li>
                      ))}
                    </ul>
                  ) : clientInput.trim() ? (
                    <div className="p-4">
                      <p className="text-sm text-gray-500 mb-3">Create a new client:</p>
                      <button
                        onClick={handleCreateClient}
                        className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-primary hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors duration-200"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create "{clientInput}"
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 text-sm text-gray-500 text-center">
                      Start typing to search or create a client
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Project Selection */}
          <div className="form-field">
            <div className="form-field-header">
              <FolderKanban className="form-field-icon" />
              <label className="form-field-title">Project</label>
            </div>
            <div className="relative">
              <input
                ref={projectInputRef}
                type="text"
                value={projectInput}
                onChange={(e) => setProjectInput(e.target.value)}
                onFocus={() => !isRunning && selectedClient && setShowProjectSuggestions(true)}
                placeholder={selectedClient ? "Search or create project..." : "Select a client first"}
                className="w-full pr-10 py-2 sm:py-3 text-sm rounded-lg bg-gray-50 border border-gray-200 focus:border-primary focus:ring-primary placeholder:text-gray-400"
                disabled={isRunning || !selectedClient}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <Search className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
              </div>
              
              {showProjectSuggestions && selectedClient && (
                <div 
                  ref={projectSuggestionsRef}
                  className="absolute z-20 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-100 max-h-60 overflow-auto top-full"
                >
                  {filteredProjects.length > 0 ? (
                    <ul className="py-1">
                      {filteredProjects.map((project) => (
                        <li
                          key={project.id}
                          onClick={() => handleProjectSelect(project)}
                          className="px-4 py-3 hover:bg-gray-50 cursor-pointer text-sm transition-colors duration-150 flex items-center"
                        >
                          <FolderKanban className="w-4 h-4 text-gray-400 mr-2" />
                          {project.name}
                        </li>
                      ))}
                    </ul>
                  ) : projectInput.trim() ? (
                    <div className="p-4">
                      <p className="text-sm text-gray-500 mb-3">Create a new project:</p>
                      <button
                        onClick={handleCreateProject}
                        className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-primary hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors duration-200"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create "{projectInput}"
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 text-sm text-gray-500 text-center">
                      Start typing to search or create a project
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Description Field */}
          <div className="form-field">
            <div className="form-field-header">
              <FileText className="form-field-icon" />
              <label className="form-field-title">Description</label>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-gray-50 text-sm"
              rows={3}
              placeholder="What are you working on?"
            />
          </div>

          {/* Billable Toggle */}
          <div className="form-field">
            <label className="flex items-center space-x-3 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={isBillable}
                  onChange={(e) => setIsBillable(e.target.checked)}
                  className="sr-only"
                  disabled={isRunning}
                />
                <div className={`w-12 h-6 sm:w-14 sm:h-7 rounded-full transition-colors duration-200 ease-in-out ${isBillable ? 'bg-accent' : 'bg-gray-200'}`}>
                  <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out ${isBillable ? 'translate-x-6 sm:translate-x-7' : 'translate-x-0'}`} />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <DollarSign className={`w-4 h-4 sm:w-5 sm:h-5 ${isBillable ? 'text-accent' : 'text-gray-400'}`} />
                <span className={`text-sm sm:text-base font-medium ${isBillable ? 'text-gray-900' : 'text-gray-500'}`}>
                  {isBillable ? 'Billable Time' : 'Non-billable Time'}
                </span>
              </div>
            </label>
          </div>

          {/* Timer Controls */}
          <div className="flex justify-center space-x-3 sm:space-x-4 mt-6">
            {!isRunning ? (
              <button
                onClick={handleStart}
                disabled={!selectedProject}
                className="btn btn-accent text-sm sm:text-base py-2 px-3 sm:py-2.5 sm:px-4"
              >
                <Play className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" />
                Start Timer
              </button>
            ) : (
              <>
                <button
                  onClick={handlePause}
                  className={`btn ${isPaused ? 'btn-accent' : 'btn-primary'} text-sm sm:text-base py-2 px-3 sm:py-2.5 sm:px-4`}
                >
                  {isPaused ? (
                    <>
                      <Play className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" />
                      Resume
                    </>
                  ) : (
                    <>
                      <Pause className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" />
                      Pause
                    </>
                  )}
                </button>
                <button
                  onClick={handleStop}
                  className="btn btn-primary text-sm sm:text-base py-2 px-3 sm:py-2.5 sm:px-4"
                >
                  <Square className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" />
                  Stop Timer
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}