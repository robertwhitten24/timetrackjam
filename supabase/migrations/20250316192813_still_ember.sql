/*
  # Time Tracking App Schema Update

  1. Tables
    - Ensures tables exist:
      - clients (name, email, user_id)
      - projects (name, client_id, user_id)
      - time_entries (project_id, start_time, end_time, description, user_id)
    
  2. Security
    - Enables RLS on all tables if not already enabled
    - Creates policies for authenticated users
*/

-- Create tables if they don't exist
DO $$ 
BEGIN
  -- Create clients table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'clients') THEN
    CREATE TABLE clients (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      email text NOT NULL,
      created_at timestamptz DEFAULT now(),
      user_id uuid REFERENCES auth.users(id) NOT NULL
    );
  END IF;

  -- Create projects table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'projects') THEN
    CREATE TABLE projects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
      created_at timestamptz DEFAULT now(),
      user_id uuid REFERENCES auth.users(id) NOT NULL
    );
  END IF;

  -- Create time_entries table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'time_entries') THEN
    CREATE TABLE time_entries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
      start_time timestamptz NOT NULL,
      end_time timestamptz,
      description text,
      created_at timestamptz DEFAULT now(),
      user_id uuid REFERENCES auth.users(id) NOT NULL
    );
  END IF;
END $$;

-- Enable RLS and create policies
DO $$ 
BEGIN
  -- Clients RLS and policies
  ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'clients' 
    AND policyname = 'Users can manage their own clients'
  ) THEN
    CREATE POLICY "Users can manage their own clients"
      ON clients
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  -- Projects RLS and policies
  ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'projects' 
    AND policyname = 'Users can manage their own projects'
  ) THEN
    CREATE POLICY "Users can manage their own projects"
      ON projects
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  -- Time entries RLS and policies
  ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'time_entries' 
    AND policyname = 'Users can manage their own time entries'
  ) THEN
    CREATE POLICY "Users can manage their own time entries"
      ON time_entries
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;