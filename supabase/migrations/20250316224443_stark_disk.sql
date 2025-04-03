/*
  # Make Rob an administrator
  
  1. Changes
    - Updates Rob's profile to have admin role
    
  2. Security
    - No changes to RLS policies
    - Maintains existing security model
*/

-- Update Rob's profile to admin role
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'rob@stackblitz.com';