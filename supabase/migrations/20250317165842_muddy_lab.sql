/*
  # Add Time Entry Audit Trail

  1. New Tables
    - `time_entry_audit`
      - `id` (uuid, primary key)
      - `time_entry_id` (uuid, references time_entries)
      - `user_id` (uuid, references auth.users)
      - `changed_at` (timestamp)
      - `old_data` (jsonb)
      - `new_data` (jsonb)
      - `action` (text)
    
  2. Security
    - Enable RLS on audit table
    - Add policies for viewing audit records
*/

-- Create time_entry_audit table
CREATE TABLE time_entry_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id uuid REFERENCES time_entries(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  changed_at timestamptz DEFAULT now(),
  old_data jsonb,
  new_data jsonb,
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE time_entry_audit ENABLE ROW LEVEL SECURITY;

-- Create policies for audit table
CREATE POLICY "Admins can view all audit records"
ON time_entry_audit
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Users can view audit records for their entries"
ON time_entry_audit
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM time_entries
    WHERE time_entries.id = time_entry_audit.time_entry_id
    AND time_entries.user_id = auth.uid()
  )
);

-- Create function to automatically record time entry changes
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
      to_jsonb(NEW),
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
      to_jsonb(OLD),
      to_jsonb(NEW),
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
      to_jsonb(OLD),
      NULL,
      'delete'
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for time_entries table
CREATE TRIGGER time_entry_audit_insert
  AFTER INSERT ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION record_time_entry_change();

CREATE TRIGGER time_entry_audit_update
  AFTER UPDATE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION record_time_entry_change();

CREATE TRIGGER time_entry_audit_delete
  AFTER DELETE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION record_time_entry_change();