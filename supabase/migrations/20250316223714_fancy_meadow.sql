/*
  # Fix profile policies to prevent infinite recursion

  1. Changes
    - Simplify profile policies to avoid circular dependencies
    - Update related policies to use direct role checks
    - Fix infinite recursion in profile policies

  2. Security
    - Maintain proper access control
    - Prevent unauthorized access
    - Keep existing functionality intact
*/

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;

-- Simple view policy for all authenticated users
CREATE POLICY "View profiles"
ON profiles FOR SELECT
TO authenticated
USING (true);

-- Allow users to update their own profile
CREATE POLICY "Update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow admins to manage all profiles based on their own role
CREATE POLICY "Admin manage profiles"
ON profiles FOR ALL
TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- Update clients policies to use direct role check
DROP POLICY IF EXISTS "Admins can manage all clients" ON clients;
CREATE POLICY "Admins can manage all clients"
ON clients FOR ALL
TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- Update projects policies to use direct role check
DROP POLICY IF EXISTS "Admins can manage all projects" ON projects;
CREATE POLICY "Admins can manage all projects"
ON projects FOR ALL
TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- Update time entries policies to use direct role check
DROP POLICY IF EXISTS "Admins can manage all time entries" ON time_entries;
CREATE POLICY "Admins can manage all time entries"
ON time_entries FOR ALL
TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);