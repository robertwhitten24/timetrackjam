/*
  # Update time entries policies and relationships

  1. Changes
    - Add foreign key relationship between time_entries and profiles if not exists
    - Update RLS policies for time entries to allow viewing by all authenticated users
*/

-- Safely handle the foreign key constraint
DO $$ 
BEGIN
  -- Check if the constraint doesn't exist before creating it
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'time_entries_user_id_fkey'
    AND table_name = 'time_entries'
  ) THEN
    ALTER TABLE time_entries
    ADD CONSTRAINT time_entries_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id)
    ON DELETE CASCADE;
  END IF;
END $$;

-- Update RLS policies for time entries
DROP POLICY IF EXISTS "Time entries are viewable by all authenticated users" ON time_entries;

CREATE POLICY "Time entries are viewable by all authenticated users"
  ON time_entries
  FOR SELECT
  TO authenticated
  USING (true);

-- Ensure RLS is enabled
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;