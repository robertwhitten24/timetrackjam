/*
  # Make user an administrator
  
  1. Changes
    - Updates the first user's profile to have admin role
    - This ensures the first registered user becomes an admin
    
  2. Security
    - No changes to RLS policies
    - Maintains existing security model
*/

-- Update the first user's profile to admin role
UPDATE profiles 
SET role = 'admin' 
WHERE id IN (
  SELECT id 
  FROM profiles 
  ORDER BY created_at 
  LIMIT 1
);