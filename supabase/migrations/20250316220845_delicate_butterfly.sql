/*
  # Fix time entries and profiles relationship

  1. Changes
    - Add foreign key relationship between time_entries and profiles
    - Update RLS policies for time entries
    - Ensure proper join capabilities for user review functionality
*/

-- Drop existing foreign key if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'time_entries_user_id_fkey'
    AND table_name = 'time_entries'
  ) THEN
    ALTER TABLE time_entries DROP CONSTRAINT time_entries_user_id_fkey;
  END IF;
END $$;

-- Add the correct foreign key relationship
ALTER TABLE time_entries
ADD CONSTRAINT time_entries_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id)
ON DELETE CASCADE;

-- Update RLS policies
DROP POLICY IF EXISTS "Time entries are viewable by all authenticated users" ON time_entries;
DROP POLICY IF EXISTS "Users can manage their own time entries" ON time_entries;

-- Create new policies
CREATE POLICY "Time entries are viewable by all authenticated users"
  ON time_entries
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage their own time entries"
  ON time_entries
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);