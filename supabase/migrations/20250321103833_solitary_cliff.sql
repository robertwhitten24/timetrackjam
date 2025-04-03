/*
  # Add billing fields to clients table

  1. Changes
    - Add hourly_rate column (decimal)
    - Add is_retainer column (boolean)
    - Add retainer_amount column (decimal)
    
  2. Security
    - Maintain existing RLS policies
*/

-- Add new columns to clients table
ALTER TABLE clients
ADD COLUMN hourly_rate decimal(10,2) DEFAULT 0.00,
ADD COLUMN is_retainer boolean DEFAULT false,
ADD COLUMN retainer_amount decimal(10,2) DEFAULT 0.00;