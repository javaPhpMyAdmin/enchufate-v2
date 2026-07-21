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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      chargers: {
        Row: {
          address: string
          connector_type: Database["public"]["Enums"]["connector_type"]
          created_at: string
          description: string
          id: string
          lat: number
          lng: number
          min_reservation_minutes: number
          owner_id: string
          photos: string[]
          power_kw: number
          price_per_hour_usd: number
          rules: string | null
          schedule: Json
          status: Database["public"]["Enums"]["charger_status"]
          title: string
          updated_at: string
        }
        Insert: {
          address: string
          connector_type: Database["public"]["Enums"]["connector_type"]
          created_at?: string
          description: string
          id?: string
          lat: number
          lng: number
          min_reservation_minutes?: number
          owner_id: string
          photos?: string[]
          power_kw: number
          price_per_hour_usd: number
          rules?: string | null
          schedule?: Json
          status?: Database["public"]["Enums"]["charger_status"]
          title: string
          updated_at?: string
        }
        Update: {
          address?: string
          connector_type?: Database["public"]["Enums"]["connector_type"]
          created_at?: string
          description?: string
          id?: string
          lat?: number
          lng?: number
          min_reservation_minutes?: number
          owner_id?: string
          photos?: string[]
          power_kw?: number
          price_per_hour_usd?: number
          rules?: string | null
          schedule?: Json
          status?: Database["public"]["Enums"]["charger_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chargers_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          charger_id: string
          created_at: string
          host_id: string
          id: string
          last_message_at: string
          renter_id: string
        }
        Insert: {
          charger_id: string
          created_at?: string
          host_id: string
          id?: string
          last_message_at?: string
          renter_id: string
        }
        Update: {
          charger_id?: string
          created_at?: string
          host_id?: string
          id?: string
          last_message_at?: string
          renter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_charger_id_fkey"
            columns: ["charger_id"]
            isOneToOne: false
            referencedRelation: "chargers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_renter_id_fkey"
            columns: ["renter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["message_kind"]
          sender_id: string | null
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["message_kind"]
          sender_id?: string | null
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["message_kind"]
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          cancelled_by: string | null
          charger_id: string
          created_at: string
          end_at: string | null
          horario_a_coordinar: string | null
          id: string
          renter_id: string
          start_at: string | null
          status: Database["public"]["Enums"]["reservation_status"]
          updated_at: string
        }
        Insert: {
          cancelled_by?: string | null
          charger_id: string
          created_at?: string
          end_at?: string | null
          horario_a_coordinar?: string | null
          id?: string
          renter_id: string
          start_at?: string | null
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Update: {
          cancelled_by?: string | null
          charger_id?: string
          created_at?: string
          end_at?: string | null
          horario_a_coordinar?: string | null
          id?: string
          renter_id?: string
          start_at?: string | null
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_charger_id_fkey"
            columns: ["charger_id"]
            isOneToOne: false
            referencedRelation: "chargers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_renter_id_fkey"
            columns: ["renter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_charger_owner: { Args: { p_charger_id: string }; Returns: boolean }
      is_reservation_party: {
        Args: { p_reservation_id: string }
        Returns: boolean
      }
    }
    Enums: {
      charger_status: "active" | "paused"
      connector_type: "tipo_1" | "tipo_2" | "ccs" | "chademo" | "tesla"
      message_kind:
        | "user"
        | "system_reservation_requested"
        | "system_reservation_confirmed"
        | "system_reservation_cancelled"
      reservation_status:
        | "solicitada"
        | "confirmada"
        | "cancelada"
        | "completada"
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
      charger_status: ["active", "paused"],
      connector_type: ["tipo_1", "tipo_2", "ccs", "chademo", "tesla"],
      message_kind: [
        "user",
        "system_reservation_requested",
        "system_reservation_confirmed",
        "system_reservation_cancelled",
      ],
      reservation_status: [
        "solicitada",
        "confirmada",
        "cancelada",
        "completada",
      ],
    },
  },
} as const
