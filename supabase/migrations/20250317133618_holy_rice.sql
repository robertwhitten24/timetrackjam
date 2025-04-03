/*
  # Fix profile RLS policies and user creation

  1. Changes
    - Drop existing profile policies
    - Create new simplified policies that allow proper profile creation
    - Fix user authentication flow
    
  2. Security
    - Allow new user profile creation
    - Maintain proper access control
    - Enable proper profile management
*/

-- Drop existing policies
DROP POLICY IF EXISTS "profiles_read" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_delete" ON profiles;
DROP POLICY IF EXISTS "allow_read_profiles" ON profiles;
DROP POLICY IF EXISTS "allow_insert_profiles" ON profiles;
DROP POLICY IF EXISTS "allow_update_profiles" ON profiles;
DROP POLICY IF EXISTS "allow_delete_profiles" ON profiles;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Enable insert access for service role" ON profiles;
DROP POLICY IF EXISTS "Enable update for users based on role" ON profiles;
DROP POLICY IF EXISTS "Enable delete for admins only" ON profiles;

-- Create new simplified policies
CREATE POLICY "anyone can create profiles"
ON profiles FOR INSERT
WITH CHECK (true);

CREATE POLICY "users can view own profile"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "admins can view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  OR auth.uid() = id
);

CREATE POLICY "admins can update all profiles"
ON profiles FOR UPDATE
TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  OR auth.uid() = id
);

-- Update handle_new_user function to handle conflicts
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    role,
    permissions,
    created_at,
    updated_at
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    'standard',
    ARRAY['timer']::text[],
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    updated_at = now();
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;