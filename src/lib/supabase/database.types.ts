// Hand-written DB types matching supabase/migrations.
// Replace with `supabase gen types typescript --project-id yifazhvphuzpdasmwllh > database.types.ts`
// once the Supabase CLI is wired up.

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type CategoryKind = "income" | "expense" | "transfer";
export type BankConnectionStatus = "pending" | "linked" | "expired" | "error" | "revoked";
export type HouseholdRole = "owner" | "member" | "viewer";
export type Recurrence = "none" | "weekly" | "monthly" | "quarterly" | "yearly";
export type SyncStatus = "running" | "success" | "error";
export type MatchField = "counterparty_name" | "counterparty_iban" | "description" | "remittance_info";
export type MatchType = "contains" | "equals" | "regex";

type WithRel<T> = T & { Relationships: [] };

export interface Database {
  public: {
    Tables: {
      households: WithRel<{
        Row: {
          id: string;
          name: string;
          base_currency: string;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          base_currency?: string;
          created_at?: string;
          created_by?: string | null;
        };
        Update: Partial<{
          id: string;
          name: string;
          base_currency: string;
          created_at: string;
          created_by: string | null;
        }>;
      }>;
      household_members: WithRel<{
        Row: {
          household_id: string;
          user_id: string;
          role: HouseholdRole;
          joined_at: string;
        };
        Insert: {
          household_id: string;
          user_id: string;
          role?: HouseholdRole;
          joined_at?: string;
        };
        Update: Partial<{
          household_id: string;
          user_id: string;
          role: HouseholdRole;
          joined_at: string;
        }>;
      }>;
      bank_connections: WithRel<{
        Row: {
          id: string;
          household_id: string;
          provider: string;
          institution_id: string;
          institution_name: string;
          institution_logo: string | null;
          requisition_id: string | null;
          agreement_id: string | null;
          status: BankConnectionStatus;
          expires_at: string | null;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          provider?: string;
          institution_id: string;
          institution_name: string;
          institution_logo?: string | null;
          requisition_id?: string | null;
          agreement_id?: string | null;
          status?: BankConnectionStatus;
          expires_at?: string | null;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          household_id: string;
          provider: string;
          institution_id: string;
          institution_name: string;
          institution_logo: string | null;
          requisition_id: string | null;
          agreement_id: string | null;
          status: BankConnectionStatus;
          expires_at: string | null;
          last_error: string | null;
        }>;
      }>;
      accounts: WithRel<{
        Row: {
          id: string;
          household_id: string;
          bank_connection_id: string;
          external_account_id: string;
          iban: string | null;
          display_name: string | null;
          owner_name: string | null;
          currency: string;
          balance_amount: number | null;
          balance_date: string | null;
          last_synced_at: string | null;
          archived: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          bank_connection_id: string;
          external_account_id: string;
          iban?: string | null;
          display_name?: string | null;
          owner_name?: string | null;
          currency?: string;
          balance_amount?: number | null;
          balance_date?: string | null;
          last_synced_at?: string | null;
          archived?: boolean;
          created_at?: string;
        };
        Update: Partial<{
          display_name: string | null;
          owner_name: string | null;
          balance_amount: number | null;
          balance_date: string | null;
          last_synced_at: string | null;
          archived: boolean;
        }>;
      }>;
      categories: WithRel<{
        Row: {
          id: string;
          household_id: string;
          parent_id: string | null;
          name: string;
          kind: CategoryKind;
          color: string | null;
          icon: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          parent_id?: string | null;
          name: string;
          kind: CategoryKind;
          color?: string | null;
          icon?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<{
          parent_id: string | null;
          name: string;
          kind: CategoryKind;
          color: string | null;
          icon: string | null;
          sort_order: number;
        }>;
      }>;
      transactions: WithRel<{
        Row: {
          id: string;
          household_id: string;
          account_id: string;
          external_id: string;
          booking_date: string;
          value_date: string | null;
          amount: number;
          currency: string;
          counterparty_name: string | null;
          counterparty_iban: string | null;
          counterparty_account: string | null;
          description: string | null;
          remittance_info: string | null;
          category_id: string | null;
          is_internal_transfer: boolean;
          notes: string | null;
          raw: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          account_id: string;
          external_id: string;
          booking_date: string;
          value_date?: string | null;
          amount: number;
          currency?: string;
          counterparty_name?: string | null;
          counterparty_iban?: string | null;
          counterparty_account?: string | null;
          description?: string | null;
          remittance_info?: string | null;
          category_id?: string | null;
          is_internal_transfer?: boolean;
          notes?: string | null;
          raw?: Json | null;
          created_at?: string;
        };
        Update: Partial<{
          category_id: string | null;
          is_internal_transfer: boolean;
          notes: string | null;
        }>;
      }>;
      categorization_rules: WithRel<{
        Row: {
          id: string;
          household_id: string;
          category_id: string;
          match_field: MatchField;
          match_type: MatchType;
          match_value: string;
          is_case_sensitive: boolean;
          priority: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          category_id: string;
          match_field: MatchField;
          match_type: MatchType;
          match_value: string;
          is_case_sensitive?: boolean;
          priority?: number;
          created_at?: string;
        };
        Update: Partial<{
          category_id: string;
          match_field: MatchField;
          match_type: MatchType;
          match_value: string;
          is_case_sensitive: boolean;
          priority: number;
        }>;
      }>;
      planned_cashflows: WithRel<{
        Row: {
          id: string;
          household_id: string;
          account_id: string | null;
          category_id: string | null;
          description: string;
          amount: number;
          currency: string;
          due_date: string;
          recurrence: Recurrence;
          recurrence_until: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          account_id?: string | null;
          category_id?: string | null;
          description: string;
          amount: number;
          currency?: string;
          due_date: string;
          recurrence?: Recurrence;
          recurrence_until?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          account_id: string | null;
          category_id: string | null;
          description: string;
          amount: number;
          currency: string;
          due_date: string;
          recurrence: Recurrence;
          recurrence_until: string | null;
        }>;
      }>;
      sync_runs: WithRel<{
        Row: {
          id: string;
          household_id: string;
          bank_connection_id: string | null;
          status: SyncStatus;
          transactions_added: number;
          error_message: string | null;
          started_at: string;
          finished_at: string | null;
        };
        Insert: {
          id?: string;
          household_id: string;
          bank_connection_id?: string | null;
          status: SyncStatus;
          transactions_added?: number;
          error_message?: string | null;
          started_at?: string;
          finished_at?: string | null;
        };
        Update: Partial<{
          status: SyncStatus;
          transactions_added: number;
          error_message: string | null;
          finished_at: string | null;
        }>;
      }>;
    };
    Views: Record<never, never>;
    Functions: {
      auth_household_ids: { Args: Record<string, never>; Returns: string[] };
      seed_default_categories: { Args: { p_household_id: string }; Returns: void };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
