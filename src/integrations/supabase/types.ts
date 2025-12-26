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
      admin_notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          is_read: boolean
          message: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          message: string
          title: string
          type: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          encrypted_key: string
          id: string
          is_active: boolean | null
          key_hint: string | null
          last_used_at: string | null
          name: string
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          encrypted_key: string
          id?: string
          is_active?: boolean | null
          key_hint?: string | null
          last_used_at?: string | null
          name: string
          provider?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          encrypted_key?: string
          id?: string
          is_active?: boolean | null
          key_hint?: string | null
          last_used_at?: string | null
          name?: string
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      billing_history: {
        Row: {
          amount_usd: number
          created_at: string
          currency: string
          description: string | null
          id: string
          invoice_url: string | null
          period_end: string | null
          period_start: string | null
          plan: string | null
          razorpay_invoice_id: string | null
          razorpay_payment_id: string | null
          receipt_url: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount_usd: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          invoice_url?: string | null
          period_end?: string | null
          period_start?: string | null
          plan?: string | null
          razorpay_invoice_id?: string | null
          razorpay_payment_id?: string | null
          receipt_url?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount_usd?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          invoice_url?: string | null
          period_end?: string | null
          period_start?: string | null
          plan?: string | null
          razorpay_invoice_id?: string | null
          razorpay_payment_id?: string | null
          receipt_url?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      monthly_usage: {
        Row: {
          created_at: string
          id: string
          month_year: string
          request_count: number
          total_cost_usd: number
          total_tokens: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          month_year: string
          request_count?: number
          total_cost_usd?: number
          total_tokens?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          month_year?: string
          request_count?: number
          total_cost_usd?: number
          total_tokens?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plan_limits: {
        Row: {
          created_at: string
          has_advanced_analytics: boolean
          has_api_access: boolean
          has_audit_logs: boolean
          has_priority_support: boolean
          has_sso: boolean
          id: string
          max_api_keys: number
          max_team_members: number
          max_tokens_per_month: number
          plan: Database["public"]["Enums"]["subscription_plan"]
          price_usd: number
        }
        Insert: {
          created_at?: string
          has_advanced_analytics?: boolean
          has_api_access?: boolean
          has_audit_logs?: boolean
          has_priority_support?: boolean
          has_sso?: boolean
          id?: string
          max_api_keys: number
          max_team_members?: number
          max_tokens_per_month: number
          plan: Database["public"]["Enums"]["subscription_plan"]
          price_usd?: number
        }
        Update: {
          created_at?: string
          has_advanced_analytics?: boolean
          has_api_access?: boolean
          has_audit_logs?: boolean
          has_priority_support?: boolean
          has_sso?: boolean
          id?: string
          max_api_keys?: number
          max_team_members?: number
          max_tokens_per_month?: number
          plan?: Database["public"]["Enums"]["subscription_plan"]
          price_usd?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          auth_provider: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_blocked: boolean | null
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auth_provider?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_blocked?: boolean | null
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auth_provider?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_blocked?: boolean | null
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      spending_alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          month_year: string
          team_id: string
          threshold_reached: number
          user_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          month_year: string
          team_id: string
          threshold_reached: number
          user_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          month_year?: string
          team_id?: string
          threshold_reached?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spending_alerts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          razorpay_customer_id: string | null
          razorpay_subscription_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          razorpay_customer_id?: string | null
          razorpay_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          razorpay_customer_id?: string | null
          razorpay_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          admin_notes: string | null
          assigned_to: string | null
          created_at: string
          email: string
          id: string
          message: string
          priority: string
          status: string
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          assigned_to?: string | null
          created_at?: string
          email: string
          id?: string
          message: string
          priority?: string
          status?: string
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          assigned_to?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string
          priority?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      team_billing_history: {
        Row: {
          created_at: string
          id: string
          invoice_url: string | null
          member_count: number
          payment_id: string | null
          period_end: string
          period_start: string
          status: string
          team_id: string
          total_cost_usd: number
          total_tokens: number
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_url?: string | null
          member_count?: number
          payment_id?: string | null
          period_end: string
          period_start: string
          status?: string
          team_id: string
          total_cost_usd?: number
          total_tokens?: number
        }
        Update: {
          created_at?: string
          id?: string
          invoice_url?: string | null
          member_count?: number
          payment_id?: string | null
          period_end?: string
          period_start?: string
          status?: string
          team_id?: string
          total_cost_usd?: number
          total_tokens?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_billing_history_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invites: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: string
          status: string
          team_id: string
          token: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: string
          status?: string
          team_id: string
          token?: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: string
          status?: string
          team_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invites_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          joined_at: string
          monthly_spending_limit: number | null
          role: string
          spending_alert_threshold: number | null
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          monthly_spending_limit?: number | null
          role?: string
          spending_alert_threshold?: number | null
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          monthly_spending_limit?: number | null
          role?: string
          spending_alert_threshold?: number | null
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          billing_email: string | null
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          billing_email?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          billing_email?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      usage_logs: {
        Row: {
          api_key_id: string | null
          cost_usd: number
          created_at: string
          endpoint: string | null
          id: string
          model: string | null
          tokens_used: number
          user_id: string
        }
        Insert: {
          api_key_id?: string | null
          cost_usd?: number
          created_at?: string
          endpoint?: string | null
          id?: string
          model?: string | null
          tokens_used?: number
          user_id: string
        }
        Update: {
          api_key_id?: string | null
          cost_usd?: number
          created_at?: string
          endpoint?: string | null
          id?: string
          model?: string | null
          tokens_used?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          payload: Json | null
          processed_at: string | null
          response_body: string | null
          response_status: number | null
          source: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
          response_body?: string | null
          response_status?: number | null
          source: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
          response_body?: string | null
          response_status?: number | null
          source?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_member_spending_limit: {
        Args: { p_month_year: string; p_team_id: string; p_user_id: string }
        Returns: {
          current_spending: number
          has_limit: boolean
          is_over_limit: boolean
          percentage_used: number
          spending_limit: number
        }[]
      }
      get_team_member_usage: {
        Args: { p_month_year: string; p_team_id: string }
        Returns: {
          email: string
          full_name: string
          percentage: number
          total_cost: number
          total_requests: number
          total_tokens: number
          user_id: string
        }[]
      }
      get_team_usage: {
        Args: { p_month_year: string; p_team_id: string }
        Returns: {
          total_cost: number
          total_requests: number
          total_tokens: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "user" | "admin"
      subscription_plan: "free" | "pro" | "team"
      subscription_status:
        | "active"
        | "cancelled"
        | "past_due"
        | "trialing"
        | "paused"
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
    Enums: {
      app_role: ["user", "admin"],
      subscription_plan: ["free", "pro", "team"],
      subscription_status: [
        "active",
        "cancelled",
        "past_due",
        "trialing",
        "paused",
      ],
    },
  },
} as const
