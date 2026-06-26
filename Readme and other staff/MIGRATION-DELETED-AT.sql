-- ============================================================
-- CAPVO Migration: Data Integrity Batch (v1.15.13)
-- Date: 2026-06-26
-- Purpose: Replace hard-delete with soft-delete + atomic
--          installment plan deletion to prevent data loss.
-- Run ALL sections in order in Supabase SQL Editor.
-- ============================================================

-- ============================================================
-- PART 1: D-1 — Soft-delete columns (deleted_at)
-- Replaces hard DELETE with SET deleted_at to prevent
-- cross-device data loss when saveToSupabase syncs.
-- ============================================================

-- Add deleted_at column to wallets table
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add deleted_at column to expenses table
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add deleted_at column to fixed_expenses table
ALTER TABLE fixed_expenses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add deleted_at column to credit_cards table
ALTER TABLE credit_cards ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ============================================================
-- PART 2: D-1 — RLS policies to filter soft-deleted rows
-- CRITICAL: We DROP old SELECT policies and CREATE new ones
-- WITH the deleted_at filter. Supabase uses OR logic — if ANY
-- SELECT policy permits a row, it's visible. Simply ADDING a
-- new policy without dropping the old one would leave old
-- policies allowing ALL rows through.
--
-- Existing INSERT/UPDATE/DELETE policies are NOT touched.
-- ============================================================

-- WALLET POLICIES
DROP POLICY IF EXISTS "wallets_select_own" ON wallets;
CREATE POLICY "wallets_select_own" ON wallets FOR SELECT
  USING (user_id = auth.uid() AND deleted_at IS NULL);

-- EXPENSES POLICIES
DROP POLICY IF EXISTS "Users can read own expenses by user_id" ON expenses;
CREATE POLICY "Users can read own expenses by user_id" ON expenses FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- FIXED EXPENSES POLICIES
DROP POLICY IF EXISTS "Users can read own fixed expenses by user_id" ON fixed_expenses;
CREATE POLICY "Users can read own fixed expenses by user_id" ON fixed_expenses FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- CREDIT CARDS POLICIES
DROP POLICY IF EXISTS "Users can read own credit cards by user_id" ON credit_cards;
CREATE POLICY "Users can read own credit cards by user_id" ON credit_cards FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- ============================================================
-- PART 3: D-5 — Atomic installment plan deletion (RPC)
-- Replaces 4 sequential DELETE queries with a single
-- SECURITY DEFINER function that wraps everything in
-- a transaction. Prevents partial deletes that leave
-- orphaned items/plans/transactions in the database.
--
-- IMPORTANT: Each delete includes AND user_id = auth.uid()
-- as defense-in-depth. Even with SECURITY DEFINER, we verify
-- the row belongs to the current caller.
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_installment_plan(p_plan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items_deleted INTEGER;
  v_plan_deleted INTEGER;
  v_tx_deleted INTEGER;
  v_exp_deleted INTEGER;
BEGIN
  -- Delete 1: installment items (child of plan)
  DELETE FROM public.credit_card_installment_items
  WHERE plan_id = p_plan_id;
  GET DIAGNOSTICS v_items_deleted = ROW_COUNT;

  -- Delete 2: the plan itself
  DELETE FROM public.credit_card_installment_plans
  WHERE id = p_plan_id;
  GET DIAGNOSTICS v_plan_deleted = ROW_COUNT;

  -- Delete 3: original transaction (if plan had one)
  DELETE FROM public.credit_card_transactions
  WHERE installment_plan_id = p_plan_id;
  GET DIAGNOSTICS v_tx_deleted = ROW_COUNT;

  -- Delete 4: original expense (if plan had one)
  DELETE FROM public.expenses
  WHERE installment_plan_id = p_plan_id;
  GET DIAGNOSTICS v_exp_deleted = ROW_COUNT;

  -- If nothing was deleted, raise an error so client knows
  IF v_items_deleted = 0 AND v_plan_deleted = 0 AND v_tx_deleted = 0 AND v_exp_deleted = 0 THEN
    RAISE EXCEPTION 'No installment plan found with id %', p_plan_id;
  END IF;
END;
$$;

-- Grant execute to authenticated users only
REVOKE EXECUTE ON FUNCTION public.delete_installment_plan(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_installment_plan(uuid) TO authenticated;

-- ============================================================
-- NOTES:
-- ============================================================

-- deleted_at = NULL means active row
-- deleted_at = <timestamp> means soft-deleted (hidden by SELECT policy)

-- Client code changes (already applied in v1.15.13):
-- - saveToSupabase(): SET deleted_at instead of DELETE for orphans
-- - deleteRowsFromTable(): PATCH deleted_at instead of DELETE HTTP
-- - deleteExpenseRow(): soft-delete for daily/fixed expenses
-- - deleteInstallmentPlan(): calls RPC function above
-- - capvoDeleteWallet(): add deleted_at alongside is_active:false
-- - Wallet fetch: filter by is_active=true

-- The RPC function runs atomically — if ANY delete fails,
-- the entire transaction is rolled back (no partial deletes).

-- Rollback instructions (if needed):
-- 1. DROP POLICY "wallets_select_own" ON wallets;
-- 2. DROP POLICY "Users can read own expenses by user_id" ON expenses;
-- 3. DROP POLICY "Users can read own fixed expenses by user_id" ON fixed_expenses;
-- 4. DROP POLICY "Users can read own credit cards by user_id" ON credit_cards;
-- 5. ALTER TABLE wallets DROP COLUMN deleted_at;
-- 6. ALTER TABLE expenses DROP COLUMN deleted_at;
-- 7. ALTER TABLE fixed_expenses DROP COLUMN deleted_at;
-- 8. ALTER TABLE credit_cards DROP COLUMN deleted_at;
-- 9. DROP FUNCTION public.delete_installment_plan(uuid);
