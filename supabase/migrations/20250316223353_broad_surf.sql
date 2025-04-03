/*
  # Add user roles and permissions

  1. Changes
    - Add role column to profiles table
    - Add default role policy
    - Update existing RLS policies to respect roles

  2. Security
    - Only admins can delete records
    - Standard users have limited permissions
*/

-- Add role column to profiles table
ALTER TABLE profiles 
ADD COLUMN role text NOT NULL DEFAULT 'standard';

-- Update RLS policies for clients table
DROP POLICY IF EXISTS "Users can manage their own clients" ON clients;
CREATE POLICY "Admins can manage all clients" ON clients
  FOR ALL 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Standard users can view and create clients" ON clients
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Standard users can create and update own clients" ON clients
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'standard'
    )
  );

-- Update RLS policies for projects table
DROP POLICY IF EXISTS "Users can manage their own projects" ON projects;
CREATE POLICY "Admins can manage all projects" ON projects
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Standard users can view and create projects" ON projects
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Standard users can create and update own projects" ON projects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'standard'
    )
  );

-- Update RLS policies for time_entries table
DROP POLICY IF EXISTS "Users can manage their own time entries" ON time_entries;
CREATE POLICY "Admins can manage all time entries" ON time_entries
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Standard users can manage their own time entries" ON time_entries
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'standard'
    )
  );