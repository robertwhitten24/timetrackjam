/*
  # Add billable flag to time entries

  1. Changes
    - Add billable column to time_entries table
    - Set default value to true
    - Update existing entries to be billable by default
    
  2. Security
    - Maintain existing RLS policies
*/

-- Add billable column to time_entries if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'time_entries' AND column_name = 'billable'
  ) THEN
    ALTER TABLE time_entries 
    ADD COLUMN billable boolean NOT NULL DEFAULT true;
  END IF;
END $$;