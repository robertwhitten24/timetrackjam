/*
  # Fix admin access and user management

  1. Changes
    - Set initial user as admin
    - Fix RLS policies for proper admin access
    - Ensure proper cascading for user management

  2. Security
    - Maintain existing security model
    - Ensure admins can manage users
    - Protect against unauthorized access
*/

-- First, ensure the role column exists and has the correct default
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE profiles ADD COLUMN role text NOT NULL DEFAULT 'standard';
  END IF;
END $$;

-- Set your user as admin (replace with your user ID)
UPDATE profiles 
SET role = 'admin' 
WHERE id = auth.uid();

-- Recreate policies for profiles table
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Allow all authenticated users to view profiles
CREATE POLICY "Users can view all profiles" 
ON profiles FOR SELECT 
TO authenticated 
USING (true);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow admins to manage all profiles
CREATE POLICY "Admins can manage all profiles" 
ON profiles FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Update clients policies
DROP POLICY IF EXISTS "Admins can manage all clients" ON clients;
DROP POLICY IF EXISTS "Standard users can view and create clients" ON clients;
DROP POLICY IF EXISTS "Standard users can create and update own clients" ON clients;

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

CREATE POLICY "Users can view all clients" ON clients
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Standard users can manage own clients" ON clients
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

-- Update projects policies
DROP POLICY IF EXISTS "Admins can manage all projects" ON projects;
DROP POLICY IF EXISTS "Standard users can view and create projects" ON projects;
DROP POLICY IF EXISTS "Standard users can create and update own projects" ON projects;

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

CREATE POLICY "Users can view all projects" ON projects
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Standard users can manage own projects" ON projects
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

-- Update time entries policies
DROP POLICY IF EXISTS "Admins can manage all time entries" ON time_entries;
DROP POLICY IF EXISTS "Standard users can manage their own time entries" ON time_entries;

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

CREATE POLICY "Users can manage own time entries" ON time_entries
FOR ALL
TO authenticated
USING (auth.uid() = user_id);