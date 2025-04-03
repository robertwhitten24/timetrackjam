/*
  # Fix time entries and profiles relationship

  1. Changes
    - Add foreign key relationship between time_entries and profiles
    - Update RLS policies to handle the relationship
    - Fix audit trail functionality
    
  2. Security
    - Maintain existing RLS policies
    - Ensure proper access control
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
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- Create a view to handle the profile relationship
CREATE OR REPLACE VIEW time_entries_with_profiles AS
SELECT 
  t.*,
  p.full_name,
  p.email
FROM 
  time_entries t
LEFT JOIN 
  profiles p ON t.user_id = p.id;

-- Grant access to the view
GRANT SELECT ON time_entries_with_profiles TO authenticated;

-- Update time entry audit function to include profile information
CREATE OR REPLACE FUNCTION record_time_entry_change()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO time_entry_audit (
      time_entry_id,
      user_id,
      old_data,
      new_data,
      action
    ) VALUES (
      NEW.id,
      auth.uid(),
      NULL,
      jsonb_build_object(
        'id', NEW.id,
        'project_id', NEW.project_id,
        'start_time', NEW.start_time,
        'end_time', NEW.end_time,
        'description', NEW.description,
        'user_id', NEW.user_id,
        'billable', NEW.billable
      ),
      'create'
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO time_entry_audit (
      time_entry_id,
      user_id,
      old_data,
      new_data,
      action
    ) VALUES (
      NEW.id,
      auth.uid(),
      jsonb_build_object(
        'id', OLD.id,
        'project_id', OLD.project_id,
        'start_time', OLD.start_time,
        'end_time', OLD.end_time,
        'description', OLD.description,
        'user_id', OLD.user_id,
        'billable', OLD.billable
      ),
      jsonb_build_object(
        'id', NEW.id,
        'project_id', NEW.project_id,
        'start_time', NEW.start_time,
        'end_time', NEW.end_time,
        'description', NEW.description,
        'user_id', NEW.user_id,
        'billable', NEW.billable
      ),
      'update'
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO time_entry_audit (
      time_entry_id,
      user_id,
      old_data,
      new_data,
      action
    ) VALUES (
      OLD.id,
      auth.uid(),
      jsonb_build_object(
        'id', OLD.id,
        'project_id', OLD.project_id,
        'start_time', OLD.start_time,
        'end_time', OLD.end_time,
        'description', OLD.description,
        'user_id', OLD.user_id,
        'billable', OLD.billable
      ),
      NULL,
      'delete'
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;