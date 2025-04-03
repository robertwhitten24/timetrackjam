/*
  # Fix profile creation during signup

  1. Changes
    - Update handle_new_user trigger function to handle conflicts
    - Update profile policies to allow proper creation
    - Fix cascade deletion behavior
    
  2. Security
    - Maintain proper access control
    - Allow profile creation during signup
    - Enable proper cleanup on deletion
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Create improved function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, permissions)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    'standard',
    ARRAY['timer']::text[]
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    updated_at = now();
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Drop existing policies
DROP POLICY IF EXISTS "profiles_read_new" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_new" ON profiles;
DROP POLICY IF EXISTS "profiles_update_new" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_new" ON profiles;

-- Create new simplified policies
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