/*
  # Update RLS policies for time entries

  1. Security Changes
    - Ensure RLS is enabled on time_entries table
    - Ensure policy exists for authenticated users to manage their own time entries
*/

DO $$ 
BEGIN
  -- Enable RLS if not already enabled
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'time_entries' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
  END IF;

  -- Drop existing policy if it exists
  DROP POLICY IF EXISTS "Users can manage their own time entries" ON time_entries;

  -- Create the policy
  CREATE POLICY "Users can manage their own time entries"
    ON time_entries
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
END $$;