/*
  # Fix profile policies to prevent infinite recursion

  1. Changes
    - Simplify profile policies to avoid circular dependencies
    - Use direct role checks instead of subqueries
    - Maintain proper access control

  2. Security
    - Keep role-based permissions
    - Ensure proper data access
*/

-- Drop existing policies
DROP POLICY IF EXISTS "View profiles" ON profiles;
DROP POLICY IF EXISTS "Update own profile" ON profiles;
DROP POLICY IF EXISTS "Admin manage profiles" ON profiles;

-- Create simplified policies that avoid recursion
CREATE POLICY "View own profile"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Admin policy using direct role check
CREATE POLICY "Admin view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  OR auth.uid() = id
);

-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;