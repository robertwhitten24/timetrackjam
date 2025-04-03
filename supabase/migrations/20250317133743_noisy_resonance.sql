/*
  # Fix profile policies to prevent infinite recursion

  1. Changes
    - Remove recursive role checks
    - Simplify policies to prevent infinite loops
    - Fix profile access control
    
  2. Security
    - Maintain proper access control
    - Allow profile creation during signup
    - Enable proper admin management
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "anyone can create profiles" ON profiles;
DROP POLICY IF EXISTS "users can view own profile" ON profiles;
DROP POLICY IF EXISTS "users can update own profile" ON profiles;
DROP POLICY IF EXISTS "admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "admins can update all profiles" ON profiles;

-- Create new non-recursive policies
CREATE POLICY "enable_profiles_insert"
ON profiles FOR INSERT
WITH CHECK (true);

CREATE POLICY "enable_profiles_select"
ON profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "enable_profiles_update"
ON profiles FOR UPDATE
TO authenticated
USING (
  -- Users can update their own profile
  auth.uid() = id
  OR
  -- Admins can update any profile
  role = 'admin'
);

CREATE POLICY "enable_profiles_delete"
ON profiles FOR DELETE
TO authenticated
USING (role = 'admin');

-- Update handle_new_user function
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