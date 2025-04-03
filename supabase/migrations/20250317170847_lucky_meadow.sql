/*
  # Remove audit history and clean up

  1. Changes
    - Drop audit table and triggers
    - Drop audit function
    - Keep time entries view for profile relationship
    
  2. Security
    - Maintain existing RLS policies
    - Keep proper access control
*/

-- Drop audit triggers
DROP TRIGGER IF EXISTS time_entry_audit_insert ON time_entries;
DROP TRIGGER IF EXISTS time_entry_audit_update ON time_entries;
DROP TRIGGER IF EXISTS time_entry_audit_delete ON time_entries;

-- Drop audit function
DROP FUNCTION IF EXISTS record_time_entry_change();

-- Drop audit table
DROP TABLE IF EXISTS time_entry_audit;

-- Recreate the view without audit dependencies
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