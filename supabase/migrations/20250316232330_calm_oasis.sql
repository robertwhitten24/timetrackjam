/*
  # Fix profile policies and permissions

  1. Changes
    - Drop existing policies
    - Create new simplified policies
    - Fix profile creation and management
    
  2. Security
    - Allow profile creation for new users
    - Maintain proper access control
    - Enable admin management
*/

-- Drop existing policies
DROP POLICY IF EXISTS "profiles_read" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_delete" ON profiles;

-- Create new simplified policies
CREATE POLICY "allow_read_profiles"
ON profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "allow_insert_profiles"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "allow_update_profiles"
ON profiles FOR UPDATE
TO authenticated
USING (
  auth.uid() = id 
  OR (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
);

CREATE POLICY "allow_delete_profiles"
ON profiles FOR DELETE
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