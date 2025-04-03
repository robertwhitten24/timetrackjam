// Database types
export interface Client {
  id: string;
  name: string;
  email: string;
}

export interface Project {
  id: string;
  name: string;
  client_id: string;
  client?: Client;
}

export interface TimeEntry {
  id: string;
  project_id: string;
  start_time: string;
  end_time: string | null;
  description: string;
  project?: Project & {
    client?: Client;
  };
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  screen: string;
}

// Define all available permissions and their corresponding screens
export const AVAILABLE_PERMISSIONS = [
  { 
    id: 'timer', 
    name: 'Timer', 
    description: 'Track time for projects and clients. Essential for logging work hours and activities.',
    screen: 'timer'
  },
  { 
    id: 'clients', 
    name: 'Clients', 
    description: 'View and manage client information. Required for working with client-specific projects.',
    screen: 'clients'
  },
  { 
    id: 'projects', 
    name: 'Projects', 
    description: 'Access project management features. Needed for organizing work and tracking time against specific projects.',
    screen: 'projects'
  },
  { 
    id: 'entries', 
    name: 'Time Entries', 
    description: 'View and manage time entries. Essential for reviewing and editing logged time.',
    screen: 'entries'
  },
  { 
    id: 'reports', 
    name: 'Reports', 
    description: 'Generate and view time reports. Important for analyzing time data and creating client reports.',
    screen: 'reports'
  },
  { 
    id: 'team-review', 
    name: 'Team Review', 
    description: 'View team members\' time entries and activities. Useful for team collaboration and oversight.',
    screen: 'team-review'
  }
] as const;