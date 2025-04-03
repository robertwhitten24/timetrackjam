/*
  # Fix policy recursion

  1. Changes
    - Simplify policies to avoid recursion
    - Use direct role checks
    - Ensure proper access control
    
  2. Security
    - Maintain proper role-based access
    - Fix infinite recursion issues
    - Keep existing security model
*/

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "allow_view_profiles" ON profiles;
DROP POLICY IF EXISTS "allow_update_own_profile" ON profiles;
DROP POLICY IF EXISTS "allow_admin_manage_profiles" ON profiles;
DROP POLICY IF EXISTS "allow_view_clients" ON clients;
DROP POLICY IF EXISTS "allow_admin_manage_clients" ON clients;
DROP POLICY IF EXISTS "allow_standard_manage_own_clients" ON clients;
DROP POLICY IF EXISTS "allow_view_projects" ON projects;
DROP POLICY IF EXISTS "allow_admin_manage_projects" ON projects;
DROP POLICY IF EXISTS "allow_standard_manage_own_projects" ON projects;
DROP POLICY IF EXISTS "allow_view_time_entries" ON time_entries;
DROP POLICY IF EXISTS "allow_admin_manage_time_entries" ON time_entries;
DROP POLICY IF EXISTS "allow_standard_manage_own_time_entries" ON time_entries;

-- Simple profile policies that avoid recursion
CREATE POLICY "profiles_select"
ON profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "profiles_update"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_admin"
ON profiles FOR ALL
TO authenticated
USING (role = 'admin');

-- Client policies
CREATE POLICY "clients_select"
ON clients FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "clients_admin"
ON clients FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid()
  AND profiles.role = 'admin'
));

CREATE POLICY "clients_standard"
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

-- Project policies
CREATE POLICY "projects_select"
ON projects FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "projects_admin"
ON projects FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid()
  AND profiles.role = 'admin'
));

CREATE POLICY "projects_standard"
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
CREATE POLICY "time_entries_select"
ON time_entries FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "time_entries_admin"
ON time_entries FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid()
  AND profiles.role = 'admin'
));

CREATE POLICY "time_entries_standard"
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

-- Ensure RLS is enabled on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;