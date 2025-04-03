/*
  # Fix team management functionality

  1. Changes
    - Set up proper role management
    - Fix profile policies
    - Add admin-specific policies
    - Ensure proper access control
    
  2. Security
    - Maintain proper role-based access
    - Enable admin capabilities
    - Protect sensitive operations
*/

-- First ensure the role column exists with correct default
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE profiles ADD COLUMN role text NOT NULL DEFAULT 'standard';
  END IF;
END $$;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "allow_select_own_profile" ON profiles;
DROP POLICY IF EXISTS "allow_update_own_profile" ON profiles;
DROP POLICY IF EXISTS "allow_select_clients" ON clients;
DROP POLICY IF EXISTS "allow_manage_own_clients" ON clients;
DROP POLICY IF EXISTS "allow_select_projects" ON projects;
DROP POLICY IF EXISTS "allow_manage_own_projects" ON projects;
DROP POLICY IF EXISTS "allow_select_time_entries" ON time_entries;
DROP POLICY IF EXISTS "allow_manage_own_time_entries" ON time_entries;

-- Set up admin role for the first user (you'll need to replace this with the actual user ID)
UPDATE profiles 
SET role = 'admin' 
WHERE id IN (
  SELECT id FROM profiles 
  ORDER BY created_at 
  LIMIT 1
);

-- Profile policies
CREATE POLICY "allow_view_profiles"
ON profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "allow_update_own_profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "allow_admin_manage_profiles"
ON profiles FOR ALL
TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- Client policies
CREATE POLICY "allow_view_clients"
ON clients FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "allow_admin_manage_clients"
ON clients FOR ALL
TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "allow_standard_manage_own_clients"
ON clients FOR ALL
TO authenticated
USING (
  auth.uid() = user_id
  AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'standard'
);

-- Project policies
CREATE POLICY "allow_view_projects"
ON projects FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "allow_admin_manage_projects"
ON projects FOR ALL
TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "allow_standard_manage_own_projects"
ON projects FOR ALL
TO authenticated
USING (
  auth.uid() = user_id
  AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'standard'
);

-- Time entries policies
CREATE POLICY "allow_view_time_entries"
ON time_entries FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "allow_admin_manage_time_entries"
ON time_entries FOR ALL
TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "allow_standard_manage_own_time_entries"
ON time_entries FOR ALL
TO authenticated
USING (
  auth.uid() = user_id
  AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'standard'
);

-- Ensure RLS is enabled on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;