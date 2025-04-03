/*
  # Fix profile creation and RLS policies

  1. Changes
    - Drop existing policies to start fresh
    - Add policies that allow profile creation and management
    - Fix permissions for authenticated users
    
  2. Security
    - Maintain proper access control
    - Allow profile creation during signup
    - Enable proper admin management
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Enable insert access for service role" ON profiles;
DROP POLICY IF EXISTS "Enable update for users based on role" ON profiles;
DROP POLICY IF EXISTS "Enable delete for admins only" ON profiles;

-- Create new policies
CREATE POLICY "profiles_read"
ON profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "profiles_insert"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow users to create their own profile
  auth.uid() = id
  OR
  -- Allow admins to create profiles
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "profiles_update"
ON profiles FOR UPDATE
TO authenticated
USING (
  -- Users can update their own profile
  auth.uid() = id
  OR
  -- Admins can update any profile
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
)
WITH CHECK (
  -- Users can update their own profile
  auth.uid() = id
  OR
  -- Admins can update any profile
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "profiles_delete"
ON profiles FOR DELETE
TO authenticated
USING (
  -- Only admins can delete profiles
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;