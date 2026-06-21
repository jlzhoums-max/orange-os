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
          provider_account_id: string;
          account_email: string | null;
          display_name: string | null;
          avatar_url: string | null;
          is_primary: boolean;
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
          provider_account_id?: string;
          account_email?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          is_primary?: boolean;
          scopes?: string[];
          access_token?: string | null;
          refresh_token?: string | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          provider_account_id?: string;
          account_email?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          is_primary?: boolean;
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
          connected_account_id: string | null;
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
          connected_account_id?: string | null;
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
          connected_account_id?: string | null;
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
          connected_account_id: string | null;
          google_event_id: string;
          calendar_id: string;
          title: string | null;
          starts_at: string | null;
          ends_at: string | null;
          location: string | null;
          attendees: Json;
          status: string | null;
          html_link: string | null;
          creator: Json | null;
          organizer: Json | null;
          recurring_event_id: string | null;
          all_day: boolean;
          time_zone: string | null;
          google_updated_at: string | null;
          raw: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          connected_account_id?: string | null;
          google_event_id: string;
          calendar_id?: string;
          title?: string | null;
          starts_at?: string | null;
          ends_at?: string | null;
          location?: string | null;
          attendees?: Json;
          status?: string | null;
          html_link?: string | null;
          creator?: Json | null;
          organizer?: Json | null;
          recurring_event_id?: string | null;
          all_day?: boolean;
          time_zone?: string | null;
          google_updated_at?: string | null;
          raw?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          connected_account_id?: string | null;
          title?: string | null;
          starts_at?: string | null;
          ends_at?: string | null;
          location?: string | null;
          attendees?: Json;
          status?: string | null;
          html_link?: string | null;
          creator?: Json | null;
          organizer?: Json | null;
          recurring_event_id?: string | null;
          all_day?: boolean;
          time_zone?: string | null;
          google_updated_at?: string | null;
          raw?: Json;
          updated_at?: string;
        };
      };
      synced_calendars: {
        Row: {
          id: string;
          user_id: string;
          connected_account_id: string;
          google_calendar_id: string;
          summary: string | null;
          description: string | null;
          time_zone: string | null;
          background_color: string | null;
          foreground_color: string | null;
          access_role: string | null;
          is_primary: boolean;
          selected: boolean;
          raw: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          connected_account_id: string;
          google_calendar_id: string;
          summary?: string | null;
          description?: string | null;
          time_zone?: string | null;
          background_color?: string | null;
          foreground_color?: string | null;
          access_role?: string | null;
          is_primary?: boolean;
          selected?: boolean;
          raw?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          summary?: string | null;
          description?: string | null;
          time_zone?: string | null;
          background_color?: string | null;
          foreground_color?: string | null;
          access_role?: string | null;
          is_primary?: boolean;
          selected?: boolean;
          raw?: Json;
          updated_at?: string;
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
      assistant_preferences: {
        Row: {
          user_id: string;
          assistant_name: string;
          default_provider: string;
          default_model_mode: string;
          developer_mode_enabled: boolean;
          memory: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          assistant_name?: string;
          default_provider?: string;
          default_model_mode?: string;
          developer_mode_enabled?: boolean;
          memory?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          assistant_name?: string;
          default_provider?: string;
          default_model_mode?: string;
          developer_mode_enabled?: boolean;
          memory?: Json;
          updated_at?: string;
        };
      };
      assistant_layouts: {
        Row: {
          id: string;
          user_id: string;
          surface: string;
          modules: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          surface: string;
          modules?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          modules?: Json;
          updated_at?: string;
        };
      };
      assistant_messages: {
        Row: {
          id: string;
          user_id: string;
          role: string;
          content: string;
          provider: string | null;
          model: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: string;
          content: string;
          provider?: string | null;
          model?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          content?: string;
          metadata?: Json;
        };
      };
      assistant_tasks: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          reason: string | null;
          status: string;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          reason?: string | null;
          status?: string;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          title?: string;
          reason?: string | null;
          status?: string;
          completed_at?: string | null;
        };
      };
      assistant_reflections: {
        Row: {
          id: string;
          user_id: string;
          reflection_date: string;
          summary: string;
          learned_preferences: Json;
          command_patterns: Json;
          shortcut_candidates: Json;
          code_notes: Json;
          unresolved_questions: Json;
          provider: string | null;
          model: string | null;
          token_usage: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          reflection_date: string;
          summary: string;
          learned_preferences?: Json;
          command_patterns?: Json;
          shortcut_candidates?: Json;
          code_notes?: Json;
          unresolved_questions?: Json;
          provider?: string | null;
          model?: string | null;
          token_usage?: Json;
          created_at?: string;
        };
        Update: {
          summary?: string;
          learned_preferences?: Json;
          command_patterns?: Json;
          shortcut_candidates?: Json;
          code_notes?: Json;
          unresolved_questions?: Json;
          provider?: string | null;
          model?: string | null;
          token_usage?: Json;
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
          connected_account_id: string | null;
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
          connected_account_id?: string | null;
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
          connected_account_id?: string | null;
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
