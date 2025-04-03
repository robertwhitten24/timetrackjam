/*
  # Fix remaining policies to prevent infinite recursion

  1. Changes
    - Simplify remaining policies to avoid circular dependencies
    - Add missing policies for standard users
    - Ensure consistent policy structure across all tables

  2. Security
    - Maintain proper access control
    - Keep existing role-based permissions
    - Prevent unauthorized access
*/

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "View profiles" ON profiles;
DROP POLICY IF EXISTS "Update own profile" ON profiles;
DROP POLICY IF EXISTS "Admin manage profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can manage all clients" ON clients;
DROP POLICY IF EXISTS "Users can view all clients" ON clients;
DROP POLICY IF EXISTS "Standard users can manage own clients" ON clients;
DROP POLICY IF EXISTS "Admins can manage all projects" ON projects;
DROP POLICY IF EXISTS "Users can view all projects" ON projects;
DROP POLICY IF EXISTS "Standard users can manage own projects" ON projects;
DROP POLICY IF EXISTS "Admins can manage all time entries" ON time_entries;
DROP POLICY IF EXISTS "Users can manage own time entries" ON time_entries;

-- Profiles policies
CREATE POLICY "View profiles"
ON profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Admin manage profiles"
ON profiles FOR ALL
TO authenticated
USING (role = 'admin');

-- Clients policies
CREATE POLICY "View clients"
ON clients FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin manage clients"
ON clients FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid()
  AND profiles.role = 'admin'
));

CREATE POLICY "Standard manage own clients"
ON clients FOR ALL
TO authenticated
USING (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'standard'
  )
);

-- Projects policies
CREATE POLICY "View projects"
ON projects FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin manage projects"
ON projects FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid()
  AND profiles.role = 'admin'
));

CREATE POLICY "Standard manage own projects"
ON projects FOR ALL
TO authenticated
USING (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'standard'
  )
);

-- Time entries policies
CREATE POLICY "View time entries"
ON time_entries FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin manage time entries"
ON time_entries FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid()
  AND profiles.role = 'admin'
));

CREATE POLICY "Standard manage own time entries"
ON time_entries FOR ALL
TO authenticated
USING (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'standard'
  )
);