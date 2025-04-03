/*
  # Add permissions column to profiles table

  1. Changes
    - Add permissions array column to profiles table
    - Set default permissions for existing users
    
  2. Security
    - Maintain existing RLS policies
    - Ensure proper access control
*/

-- Add permissions column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'permissions'
  ) THEN
    ALTER TABLE profiles 
    ADD COLUMN permissions text[] DEFAULT '{}';
  END IF;
END $$;