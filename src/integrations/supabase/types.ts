export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      account_briefs: {
        Row: {
          account_id: string | null
          approved_at: string | null
          approved_by: string | null
          brief_markdown: string
          generated_at: string
          id: string
          inputs: Json | null
          model: string | null
        }
        Insert: {
          account_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          brief_markdown?: string
          generated_at?: string
          id?: string
          inputs?: Json | null
          model?: string | null
        }
        Update: {
          account_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          brief_markdown?: string
          generated_at?: string
          id?: string
          inputs?: Json | null
          model?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_briefs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          created_at: string
          d365_owner_name: string | null
          disposition: string
          domain: string | null
          employee_count: number | null
          geography_bucket: string | null
          hq_city: string | null
          hq_country: string | null
          hq_state: string | null
          icp_score: number | null
          id: string
          industry: string | null
          lead_score: number | null
          naics_code: string | null
          name: string
          notes: string | null
          revenue_range: string | null
          source: string | null
          status: string | null
          sub_industry: string | null
          triggers: Json | null
          updated_at: string
          website: string | null
          zywave_id: string | null
        }
        Insert: {
          created_at?: string
          d365_owner_name?: string | null
          disposition?: string
          domain?: string | null
          employee_count?: number | null
          geography_bucket?: string | null
          hq_city?: string | null
          hq_country?: string | null
          hq_state?: string | null
          icp_score?: number | null
          id?: string
          industry?: string | null
          lead_score?: number | null
          naics_code?: string | null
          name: string
          notes?: string | null
          revenue_range?: string | null
          source?: string | null
          status?: string | null
          sub_industry?: string | null
          triggers?: Json | null
          updated_at?: string
          website?: string | null
          zywave_id?: string | null
        }
        Update: {
          created_at?: string
          d365_owner_name?: string | null
          disposition?: string
          domain?: string | null
          employee_count?: number | null
          geography_bucket?: string | null
          hq_city?: string | null
          hq_country?: string | null
          hq_state?: string | null
          icp_score?: number | null
          id?: string
          industry?: string | null
          lead_score?: number | null
          naics_code?: string | null
          name?: string
          notes?: string | null
          revenue_range?: string | null
          source?: string | null
          status?: string | null
          sub_industry?: string | null
          triggers?: Json | null
          updated_at?: string
          website?: string | null
          zywave_id?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          event_time: string
          id: string
        }
        Insert: {
          action: string
          actor?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          event_time?: string
          id?: string
        }
        Update: {
          action?: string
          actor?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          event_time?: string
          id?: string
        }
        Relationships: []
      }
      coi_contacts: {
        Row: {
          coi_id: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          last_name: string
          linkedin_url: string | null
          location: string | null
          phone: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          coi_id?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          linkedin_url?: string | null
          location?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          coi_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          linkedin_url?: string | null
          location?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coi_contacts_coi_id_fkey"
            columns: ["coi_id"]
            isOneToOne: false
            referencedRelation: "cois"
            referencedColumns: ["id"]
          },
        ]
      }
      coi_queue: {
        Row: {
          coi_id: string | null
          created_at: string
          id: string
          priority_rank: number
          reason: Json | null
          run_date: string
          score: number
          status: string | null
          updated_at: string
        }
        Insert: {
          coi_id?: string | null
          created_at?: string
          id?: string
          priority_rank: number
          reason?: Json | null
          run_date?: string
          score?: number
          status?: string | null
          updated_at?: string
        }
        Update: {
          coi_id?: string | null
          created_at?: string
          id?: string
          priority_rank?: number
          reason?: Json | null
          run_date?: string
          score?: number
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coi_queue_coi_id_fkey"
            columns: ["coi_id"]
            isOneToOne: false
            referencedRelation: "cois"
            referencedColumns: ["id"]
          },
        ]
      }
      cois: {
        Row: {
          created_at: string
          firm_type: string | null
          id: string
          name: string
          notes: string | null
          region: string | null
          source: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          firm_type?: string | null
          id?: string
          name: string
          notes?: string | null
          region?: string | null
          source?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          firm_type?: string | null
          id?: string
          name?: string
          notes?: string | null
          region?: string | null
          source?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      contacts_le: {
        Row: {
          account_id: string | null
          created_at: string
          department: string | null
          email: string | null
          enrichment_log: Json | null
          first_name: string
          id: string
          is_primary: boolean | null
          last_name: string
          linkedin_url: string | null
          location: string | null
          phone: string | null
          seniority: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          enrichment_log?: Json | null
          first_name: string
          id?: string
          is_primary?: boolean | null
          last_name: string
          linkedin_url?: string | null
          location?: string | null
          phone?: string | null
          seniority?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          enrichment_log?: Json | null
          first_name?: string
          id?: string
          is_primary?: boolean | null
          last_name?: string
          linkedin_url?: string | null
          location?: string | null
          phone?: string | null
          seniority?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_le_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_drafts: {
        Row: {
          account_id: string | null
          approved_at: string | null
          approved_by: string | null
          body_markdown: string | null
          contact_id: string | null
          generated_at: string
          id: string
          model: string | null
          persona: string | null
          send_status: string | null
          subject: string | null
        }
        Insert: {
          account_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          body_markdown?: string | null
          contact_id?: string | null
          generated_at?: string
          id?: string
          model?: string | null
          persona?: string | null
          send_status?: string | null
          subject?: string | null
        }
        Update: {
          account_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          body_markdown?: string | null
          contact_id?: string | null
          generated_at?: string
          id?: string
          model?: string | null
          persona?: string | null
          send_status?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_drafts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_le"
            referencedColumns: ["id"]
          },
        ]
      }
      enrichment_runs: {
        Row: {
          completed_at: string | null
          error_log: Json | null
          file_ref: string | null
          id: string
          rows_merged: number | null
          rows_new_accounts: number | null
          rows_new_contacts: number | null
          rows_processed: number | null
          rows_skipped: number | null
          rows_total: number | null
          run_type: string
          started_at: string
        }
        Insert: {
          completed_at?: string | null
          error_log?: Json | null
          file_ref?: string | null
          id?: string
          rows_merged?: number | null
          rows_new_accounts?: number | null
          rows_new_contacts?: number | null
          rows_processed?: number | null
          rows_skipped?: number | null
          rows_total?: number | null
          run_type: string
          started_at?: string
        }
        Update: {
          completed_at?: string | null
          error_log?: Json | null
          file_ref?: string | null
          id?: string
          rows_merged?: number | null
          rows_new_accounts?: number | null
          rows_new_contacts?: number | null
          rows_processed?: number | null
          rows_skipped?: number | null
          rows_total?: number | null
          run_type?: string
          started_at?: string
        }
        Relationships: []
      }
      industry_settings: {
        Row: {
          active: boolean
          created_at: string
          display_name: string
          id: string
          key: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name: string
          id?: string
          key: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string
          id?: string
          key?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      integration_settings: {
        Row: {
          api_key_ref: string | null
          created_at: string
          display_name: string
          enabled: boolean
          id: string
          provider: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          api_key_ref?: string | null
          created_at?: string
          display_name: string
          enabled?: boolean
          id?: string
          provider: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          api_key_ref?: string | null
          created_at?: string
          display_name?: string
          enabled?: boolean
          id?: string
          provider?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      lead_queue: {
        Row: {
          account_id: string | null
          claim_status: string
          claimed_at: string | null
          created_at: string
          id: string
          industry_key: string | null
          persona: string | null
          priority_rank: number
          reason: Json | null
          reject_reason: string | null
          run_date: string
          score: number
          status: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          claim_status?: string
          claimed_at?: string | null
          created_at?: string
          id?: string
          industry_key?: string | null
          persona?: string | null
          priority_rank: number
          reason?: Json | null
          reject_reason?: string | null
          run_date?: string
          score?: number
          status?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          claim_status?: string
          claimed_at?: string | null
          created_at?: string
          id?: string
          industry_key?: string | null
          persona?: string | null
          priority_rank?: number
          reason?: Json | null
          reject_reason?: string | null
          run_date?: string
          score?: number
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_queue_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      message_snapshots: {
        Row: {
          account_id: string | null
          body: string
          channel: string
          contact_id: string | null
          created_at: string
          id: string
          industry_key: string | null
          lead_queue_id: string | null
          persona: string | null
          subject: string | null
          tokens_used: Json | null
          week_number: number
        }
        Insert: {
          account_id?: string | null
          body: string
          channel: string
          contact_id?: string | null
          created_at?: string
          id?: string
          industry_key?: string | null
          lead_queue_id?: string | null
          persona?: string | null
          subject?: string | null
          tokens_used?: Json | null
          week_number: number
        }
        Update: {
          account_id?: string | null
          body?: string
          channel?: string
          contact_id?: string | null
          created_at?: string
          id?: string
          industry_key?: string | null
          lead_queue_id?: string | null
          persona?: string | null
          subject?: string | null
          tokens_used?: Json | null
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "message_snapshots_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_snapshots_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_le"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_snapshots_lead_queue_id_fkey"
            columns: ["lead_queue_id"]
            isOneToOne: false
            referencedRelation: "lead_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      signal_keywords: {
        Row: {
          category: string
          created_at: string
          id: string
          keywords: Json
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          keywords?: Json
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          keywords?: Json
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
