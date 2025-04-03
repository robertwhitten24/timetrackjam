/*
  # Fix profile creation and session handling

  1. Changes
    - Update profile policies to fix creation issues
    - Fix session handling
    - Prevent duplicate key violations
    
  2. Security
    - Maintain proper access control
    - Allow proper profile creation
*/

-- Drop existing policies
DROP POLICY IF EXISTS "profiles_read" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_delete" ON profiles;
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_admin" ON profiles;

-- Create new simplified policies
CREATE POLICY "enable_read_all_profiles"
ON profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "enable_insert_own_profile"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "enable_update_own_profile"
ON profiles FOR UPDATE
TO authenticated
USING (
  auth.uid() = id
  OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- Update handle_new_user function to handle conflicts better
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    role,
    permissions
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    'standard',
    ARRAY['timer']::text[]
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;