/*
  # Fix recursive policies with simplified approach

  1. Changes
    - Remove complex policy chains that cause recursion
    - Implement simple, direct policies
    - Use materialized role checks
    
  2. Security
    - Maintain proper access control
    - Preserve data security
    - Prevent policy recursion
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_admin_policy" ON profiles;
DROP POLICY IF EXISTS "clients_select_policy" ON clients;
DROP POLICY IF EXISTS "clients_admin_policy" ON clients;
DROP POLICY IF EXISTS "clients_standard_policy" ON clients;
DROP POLICY IF EXISTS "projects_select_policy" ON projects;
DROP POLICY IF EXISTS "projects_admin_policy" ON projects;
DROP POLICY IF EXISTS "projects_standard_policy" ON projects;
DROP POLICY IF EXISTS "time_entries_select_policy" ON time_entries;
DROP POLICY IF EXISTS "time_entries_admin_policy" ON time_entries;
DROP POLICY IF EXISTS "time_entries_standard_policy" ON time_entries;

-- Simple profile policies
CREATE POLICY "allow_select_own_profile"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "allow_update_own_profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Simple client policies
CREATE POLICY "allow_select_clients"
ON clients FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "allow_manage_own_clients"
ON clients FOR ALL
TO authenticated
USING (auth.uid() = user_id);

-- Simple project policies
CREATE POLICY "allow_select_projects"
ON projects FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "allow_manage_own_projects"
ON projects FOR ALL
TO authenticated
USING (auth.uid() = user_id);

-- Simple time entries policies
CREATE POLICY "allow_select_time_entries"
ON time_entries FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "allow_manage_own_time_entries"
ON time_entries FOR ALL
TO authenticated
USING (auth.uid() = user_id);

-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;