/*
  # Fix user deletion and RLS policies

  1. Changes
    - Add ON DELETE CASCADE to profile references
    - Update RLS policies to ensure proper deletion
    - Fix profile handling
    
  2. Security
    - Maintain proper access control
    - Enable proper cleanup of user data
*/

-- First ensure we have the correct foreign key relationship
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'profiles_id_fkey'
  ) THEN
    ALTER TABLE profiles
    DROP CONSTRAINT profiles_id_fkey;
  END IF;
END $$;

ALTER TABLE profiles
ADD CONSTRAINT profiles_id_fkey
FOREIGN KEY (id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- Drop existing policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "allow_read_profiles" ON profiles;
  DROP POLICY IF EXISTS "allow_insert_profiles" ON profiles;
  DROP POLICY IF EXISTS "allow_update_profiles" ON profiles;
  DROP POLICY IF EXISTS "allow_delete_profiles" ON profiles;
  
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'profiles_read' 
    AND tablename = 'profiles'
  ) THEN
    DROP POLICY "profiles_read" ON profiles;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'profiles_insert' 
    AND tablename = 'profiles'
  ) THEN
    DROP POLICY "profiles_insert" ON profiles;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'profiles_update' 
    AND tablename = 'profiles'
  ) THEN
    DROP POLICY "profiles_update" ON profiles;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'profiles_delete' 
    AND tablename = 'profiles'
  ) THEN
    DROP POLICY "profiles_delete" ON profiles;
  END IF;
END $$;

-- Create new policies
CREATE POLICY "profiles_read_new"
ON profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "profiles_insert_new"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = id OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "profiles_update_new"
ON profiles FOR UPDATE
TO authenticated
USING (
  auth.uid() = id OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "profiles_delete_new"
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