/*
  # Fix profile policies and permissions

  1. Changes
    - Simplify profile policies to avoid recursion
    - Add proper admin management capabilities
    - Ensure proper access control for team management
    
  2. Security
    - Enable RLS
    - Set up proper policies for profile management
*/

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_admin" ON profiles;

-- Create simplified policies
CREATE POLICY "profiles_read_all"
ON profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "profiles_insert_admin"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

CREATE POLICY "profiles_update_own"
ON profiles FOR UPDATE
TO authenticated
USING (
  -- Users can update their own profile
  auth.uid() = id
  OR
  -- Admins can update any profile
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
)
WITH CHECK (
  -- Users can update their own profile
  auth.uid() = id
  OR
  -- Admins can update any profile
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

CREATE POLICY "profiles_delete_admin"
ON profiles FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;