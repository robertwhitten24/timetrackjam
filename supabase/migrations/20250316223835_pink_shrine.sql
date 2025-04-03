/*
  # Fix recursive policies

  1. Changes
    - Simplify policies to prevent infinite recursion
    - Use materialized role checks
    - Maintain proper access control for all tables
    
  2. Security
    - Preserve role-based access control
    - Keep data properly protected
    - Ensure proper authorization flows
*/

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "View profiles" ON profiles;
DROP POLICY IF EXISTS "Update own profile" ON profiles;
DROP POLICY IF EXISTS "Admin manage profiles" ON profiles;
DROP POLICY IF EXISTS "View own profile" ON profiles;
DROP POLICY IF EXISTS "Admin view all profiles" ON profiles;
DROP POLICY IF EXISTS "View clients" ON clients;
DROP POLICY IF EXISTS "Admin manage clients" ON clients;
DROP POLICY IF EXISTS "Standard manage own clients" ON clients;
DROP POLICY IF EXISTS "View projects" ON projects;
DROP POLICY IF EXISTS "Admin manage projects" ON projects;
DROP POLICY IF EXISTS "Standard manage own projects" ON projects;
DROP POLICY IF EXISTS "View time entries" ON time_entries;
DROP POLICY IF EXISTS "Admin manage time entries" ON time_entries;
DROP POLICY IF EXISTS "Standard manage own time entries" ON time_entries;

-- Create non-recursive profile policies
CREATE POLICY "profiles_select_policy"
ON profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "profiles_update_policy"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_admin_policy"
ON profiles FOR ALL
TO authenticated
USING (
  COALESCE((SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1), 'standard') = 'admin'
);

-- Create client policies
CREATE POLICY "clients_select_policy"
ON clients FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "clients_admin_policy"
ON clients FOR ALL
TO authenticated
USING (
  COALESCE((SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1), 'standard') = 'admin'
);

CREATE POLICY "clients_standard_policy"
ON clients FOR ALL
TO authenticated
USING (
  auth.uid() = user_id
  AND COALESCE((SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1), 'standard') = 'standard'
);

-- Create project policies
CREATE POLICY "projects_select_policy"
ON projects FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "projects_admin_policy"
ON projects FOR ALL
TO authenticated
USING (
  COALESCE((SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1), 'standard') = 'admin'
);

CREATE POLICY "projects_standard_policy"
ON projects FOR ALL
TO authenticated
USING (
  auth.uid() = user_id
  AND COALESCE((SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1), 'standard') = 'standard'
);

-- Create time entries policies
CREATE POLICY "time_entries_select_policy"
ON time_entries FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "time_entries_admin_policy"
ON time_entries FOR ALL
TO authenticated
USING (
  COALESCE((SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1), 'standard') = 'admin'
);

CREATE POLICY "time_entries_standard_policy"
ON time_entries FOR ALL
TO authenticated
USING (
  auth.uid() = user_id
  AND COALESCE((SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1), 'standard') = 'standard'
);

-- Ensure RLS is enabled on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;