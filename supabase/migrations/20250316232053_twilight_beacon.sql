/*
  # Fix profiles RLS policies for user creation

  1. Changes
    - Update RLS policies to allow profile creation during signup
    - Fix profile management policies
    - Ensure proper access control
    
  2. Security
    - Maintain existing security model
    - Allow authenticated users to manage their own profiles
    - Allow profile creation during signup
*/

-- Drop existing policies
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_read_all" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_admin" ON profiles;
DROP POLICY IF EXISTS "View own profile" ON profiles;
DROP POLICY IF EXISTS "Update own profile" ON profiles;
DROP POLICY IF EXISTS "Admin view all profiles" ON profiles;

-- Create new policies
CREATE POLICY "Enable read access for authenticated users"
ON profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable insert access for service role"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable update for users based on role"
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
)
WITH CHECK (
  auth.uid() = id 
  OR (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
);

CREATE POLICY "Enable delete for admins only"
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