export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          updated_at?: string;
        };
      };
      real_estate_projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          address: string | null;
          project_type: string | null;
          status: string;
          risk: string;
          estimated_value: number;
          purchase_price: number;
          target_budget: number;
          progress: number;
          due: string | null;
          next_action: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          address?: string | null;
          project_type?: string | null;
          status?: string;
          risk?: string;
          estimated_value?: number;
          purchase_price?: number;
          target_budget?: number;
          progress?: number;
          due?: string | null;
          next_action?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          address?: string | null;
          project_type?: string | null;
          status?: string;
          risk?: string;
          estimated_value?: number;
          purchase_price?: number;
          target_budget?: number;
          progress?: number;
          due?: string | null;
          next_action?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
      };
      project_expenses: {
        Row: {
          id: string;
          user_id: string;
          project_id: string;
          category: string;
          vendor: string;
          amount: number;
          expense_date: string;
          status: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id: string;
          category: string;
          vendor: string;
          amount?: number;
          expense_date: string;
          status?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          vendor?: string;
          amount?: number;
          expense_date?: string;
          status?: string;
          notes?: string | null;
          updated_at?: string;
        };
      };
      expense_attachments: {
        Row: {
          id: string;
          user_id: string;
          expense_id: string;
          storage_path: string;
          file_name: string;
          content_type: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          expense_id: string;
          storage_path: string;
          file_name: string;
          content_type?: string | null;
          created_at?: string;
        };
        Update: {
          file_name?: string;
          content_type?: string | null;
        };
      };
      connected_accounts: {
        Row: {
          id: string;
          user_id: string;
          provider: string;
          account_email: string | null;
          scopes: string[];
          access_token: string | null;
          refresh_token: string | null;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: string;
          account_email?: string | null;
          scopes?: string[];
          access_token?: string | null;
          refresh_token?: string | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          account_email?: string | null;
          scopes?: string[];
          access_token?: string | null;
          refresh_token?: string | null;
          expires_at?: string | null;
          updated_at?: string;
        };
      };
      synced_emails: {
        Row: {
          id: string;
          user_id: string;
          gmail_message_id: string;
          thread_id: string | null;
          sender: string | null;
          subject: string | null;
          snippet: string | null;
          received_at: string | null;
          labels: string[];
          raw: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          gmail_message_id: string;
          thread_id?: string | null;
          sender?: string | null;
          subject?: string | null;
          snippet?: string | null;
          received_at?: string | null;
          labels?: string[];
          raw?: Json;
          created_at?: string;
        };
        Update: {
          sender?: string | null;
          subject?: string | null;
          snippet?: string | null;
          labels?: string[];
          raw?: Json;
        };
      };
      synced_calendar_events: {
        Row: {
          id: string;
          user_id: string;
          google_event_id: string;
          calendar_id: string;
          title: string | null;
          starts_at: string | null;
          ends_at: string | null;
          location: string | null;
          attendees: Json;
          raw: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          google_event_id: string;
          calendar_id?: string;
          title?: string | null;
          starts_at?: string | null;
          ends_at?: string | null;
          location?: string | null;
          attendees?: Json;
          raw?: Json;
          created_at?: string;
        };
        Update: {
          title?: string | null;
          starts_at?: string | null;
          ends_at?: string | null;
          location?: string | null;
          attendees?: Json;
          raw?: Json;
        };
      };
      market_watchlist: {
        Row: {
          id: string;
          user_id: string;
          symbol: string;
          name: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          symbol: string;
          name?: string | null;
          created_at?: string;
        };
        Update: {
          symbol?: string;
          name?: string | null;
        };
      };
      market_quotes: {
        Row: {
          id: string;
          symbol: string;
          price: number | null;
          change_percent: number | null;
          provider: string;
          raw: Json;
          fetched_at: string;
        };
        Insert: {
          id?: string;
          symbol: string;
          price?: number | null;
          change_percent?: number | null;
          provider: string;
          raw?: Json;
          fetched_at?: string;
        };
        Update: {
          price?: number | null;
          change_percent?: number | null;
          raw?: Json;
          fetched_at?: string;
        };
      };
      ai_briefs: {
        Row: {
          id: string;
          user_id: string;
          day_part: string;
          headline: string;
          narrative: string;
          focus_items: Json;
          suggested_tasks: Json;
          reply_drafts: Json;
          project_updates: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          day_part: string;
          headline: string;
          narrative: string;
          focus_items?: Json;
          suggested_tasks?: Json;
          reply_drafts?: Json;
          project_updates?: Json;
          created_at?: string;
        };
        Update: {
          headline?: string;
          narrative?: string;
          focus_items?: Json;
          suggested_tasks?: Json;
          reply_drafts?: Json;
          project_updates?: Json;
        };
      };
      todo_tasks: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          notes: string;
          project: string;
          due_date: string | null;
          priority: number | null;
          labels: string[];
          completed: boolean;
          amount: string | null;
          flagged: boolean;
          someday: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          notes?: string;
          project?: string;
          due_date?: string | null;
          priority?: number | null;
          labels?: string[];
          completed?: boolean;
          amount?: string | null;
          flagged?: boolean;
          someday?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          notes?: string;
          project?: string;
          due_date?: string | null;
          priority?: number | null;
          labels?: string[];
          completed?: boolean;
          amount?: string | null;
          flagged?: boolean;
          someday?: boolean;
          updated_at?: string;
        };
      };
      ledger_expenses: {
        Row: {
          id: string;
          user_id: string;
          label: string;
          amount: number;
          bucket: string;
          expense_date: string;
          month: string;
          tags: string[];
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          label: string;
          amount?: number;
          bucket: string;
          expense_date?: string;
          month: string;
          tags?: string[];
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          label?: string;
          amount?: number;
          bucket?: string;
          expense_date?: string;
          month?: string;
          tags?: string[];
          notes?: string | null;
          updated_at?: string;
        };
      };
      ledger_accounts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          account_type: string;
          balance: number;
          category: string;
          institution: string | null;
          notes: string | null;
          last_updated_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          account_type: string;
          balance?: number;
          category: string;
          institution?: string | null;
          notes?: string | null;
          last_updated_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          account_type?: string;
          balance?: number;
          category?: string;
          institution?: string | null;
          notes?: string | null;
          last_updated_at?: string;
          updated_at?: string;
        };
      };
      ledger_settings: {
        Row: {
          user_id: string;
          monthly_base: number;
          split_needs: number;
          split_wants: number;
          split_savings: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          monthly_base?: number;
          split_needs?: number;
          split_wants?: number;
          split_savings?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          monthly_base?: number;
          split_needs?: number;
          split_wants?: number;
          split_savings?: number;
          updated_at?: string;
        };
      };
      sync_runs: {
        Row: {
          id: string;
          user_id: string | null;
          trigger: string;
          status: string;
          gmail_count: number;
          calendar_count: number;
          market_count: number;
          error: string | null;
          started_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          trigger: string;
          status?: string;
          gmail_count?: number;
          calendar_count?: number;
          market_count?: number;
          error?: string | null;
          started_at?: string;
          completed_at?: string | null;
        };
        Update: {
          status?: string;
          gmail_count?: number;
          calendar_count?: number;
          market_count?: number;
          error?: string | null;
          completed_at?: string | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
