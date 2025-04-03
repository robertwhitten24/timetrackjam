/*
  # Add retainer hours to clients table

  1. Changes
    - Add retainer_hours column to clients table
    - Set default value to 0
    
  2. Security
    - Maintain existing RLS policies
*/

ALTER TABLE clients
ADD COLUMN retainer_hours decimal(10,2) DEFAULT 0.00;