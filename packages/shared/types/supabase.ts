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
      admin_users: {
        Row: {
          created_at: string
          email: string
          first_name: string
          id: string
          is_org_admin: boolean
          last_name: string
          organization_id: string
          permissions: Json | null
          role: Database["public"]["Enums"]["org_user_role"]
        }
        Insert: {
          created_at?: string
          email: string
          first_name: string
          id: string
          is_org_admin?: boolean
          last_name: string
          organization_id: string
          permissions?: Json | null
          role?: Database["public"]["Enums"]["org_user_role"]
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          is_org_admin?: boolean
          last_name?: string
          organization_id?: string
          permissions?: Json | null
          role?: Database["public"]["Enums"]["org_user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "admin_users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          archived_at: string | null
          created_at: string
          donation_declared_at: string | null
          event_date: string
          gear_drop_off_end_time: string | null
          gear_drop_off_place: string | null
          gear_drop_off_start_time: string | null
          id: string
          items_locked: boolean
          name: string
          organization_id: string
          pickup_end_time: string | null
          pickup_start_time: string | null
          price_drop_time: string | null
          registration_close_date: string | null
          registration_open_date: string | null
          settings: Json | null
          shop_close_time: string | null
          shop_open_time: string | null
          status: Database["public"]["Enums"]["event_status"] | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          donation_declared_at?: string | null
          event_date: string
          gear_drop_off_end_time?: string | null
          gear_drop_off_place?: string | null
          gear_drop_off_start_time?: string | null
          id?: string
          items_locked?: boolean
          name: string
          organization_id: string
          pickup_end_time?: string | null
          pickup_start_time?: string | null
          price_drop_time?: string | null
          registration_close_date?: string | null
          registration_open_date?: string | null
          settings?: Json | null
          shop_close_time?: string | null
          shop_open_time?: string | null
          status?: Database["public"]["Enums"]["event_status"] | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          donation_declared_at?: string | null
          event_date?: string
          gear_drop_off_end_time?: string | null
          gear_drop_off_place?: string | null
          gear_drop_off_start_time?: string | null
          id?: string
          items_locked?: boolean
          name?: string
          organization_id?: string
          pickup_end_time?: string | null
          pickup_start_time?: string | null
          price_drop_time?: string | null
          registration_close_date?: string | null
          registration_open_date?: string | null
          settings?: Json | null
          shop_close_time?: string | null
          shop_open_time?: string | null
          status?: Database["public"]["Enums"]["event_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      gear_tag_templates: {
        Row: {
          border_width: number | null
          category_ids: string[] | null
          created_at: string
          description: string | null
          display_order: number
          font_family: string | null
          font_size: number | null
          height_mm: number
          id: string
          is_active: boolean
          is_default: boolean
          layout_type: string
          name: string
          organization_id: string
          qr_code_data_fields: Json | null
          qr_code_enabled: boolean
          qr_code_position: string | null
          qr_code_seller_access: Json | null
          qr_code_size: number | null
          required_fields: string[]
          tag_fields: Json
          updated_at: string
          width_mm: number
        }
        Insert: {
          border_width?: number | null
          category_ids?: string[] | null
          created_at?: string
          description?: string | null
          display_order?: number
          font_family?: string | null
          font_size?: number | null
          height_mm?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          layout_type?: string
          name: string
          organization_id: string
          qr_code_data_fields?: Json | null
          qr_code_enabled?: boolean
          qr_code_position?: string | null
          qr_code_seller_access?: Json | null
          qr_code_size?: number | null
          required_fields?: string[]
          tag_fields?: Json
          updated_at?: string
          width_mm?: number
        }
        Update: {
          border_width?: number | null
          category_ids?: string[] | null
          created_at?: string
          description?: string | null
          display_order?: number
          font_family?: string | null
          font_size?: number | null
          height_mm?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          layout_type?: string
          name?: string
          organization_id?: string
          qr_code_data_fields?: Json | null
          qr_code_enabled?: boolean
          qr_code_position?: string | null
          qr_code_seller_access?: Json | null
          qr_code_size?: number | null
          required_fields?: string[]
          tag_fields?: Json
          updated_at?: string
          width_mm?: number
        }
        Relationships: [
          {
            foreignKeyName: "gear_tag_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      item_categories: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name: string
          organization_id: string
          parent_id: string | null
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          parent_id?: string | null
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "item_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      item_field_definitions: {
        Row: {
          created_at: string
          default_value: string | null
          display_order: number
          field_type: Database["public"]["Enums"]["field_type"]
          help_text: string | null
          id: string
          is_price_field: boolean
          is_price_reduction_field: boolean
          is_required: boolean
          label: string
          name: string
          options: Json | null
          organization_id: string
          placeholder: string | null
          price_reduction_percentage: boolean
          price_reduction_time_control: string
          validation_rules: Json | null
        }
        Insert: {
          created_at?: string
          default_value?: string | null
          display_order?: number
          field_type: Database["public"]["Enums"]["field_type"]
          help_text?: string | null
          id?: string
          is_price_field?: boolean
          is_price_reduction_field?: boolean
          is_required?: boolean
          label: string
          name: string
          options?: Json | null
          organization_id: string
          placeholder?: string | null
          price_reduction_percentage?: boolean
          price_reduction_time_control?: string
          validation_rules?: Json | null
        }
        Update: {
          created_at?: string
          default_value?: string | null
          display_order?: number
          field_type?: Database["public"]["Enums"]["field_type"]
          help_text?: string | null
          id?: string
          is_price_field?: boolean
          is_price_reduction_field?: boolean
          is_required?: boolean
          label?: string
          name?: string
          options?: Json | null
          organization_id?: string
          placeholder?: string | null
          price_reduction_percentage?: boolean
          price_reduction_time_control?: string
          validation_rules?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "item_field_definitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          category: string
          category_id: string | null
          checked_in_at: string | null
          created_at: string
          custom_fields: Json | null
          description: string
          donate_if_unsold: boolean
          enable_price_reduction: boolean
          event_id: string
          id: string
          item_number: string
          original_price: number
          paid_at: string | null
          price_reduction_times: Json | null
          qr_code: string
          reduced_price: number | null
          seller_item_label: string | null
          seller_id: string
          size: string | null
          sold_at: string | null
          sold_price: number | null
          status: Database["public"]["Enums"]["item_status"]
        }
        Insert: {
          category: string
          category_id?: string | null
          checked_in_at?: string | null
          created_at?: string
          custom_fields?: Json | null
          description: string
          donate_if_unsold?: boolean
          enable_price_reduction?: boolean
          event_id: string
          id?: string
          item_number: string
          original_price: number
          paid_at?: string | null
          price_reduction_times?: Json | null
          qr_code: string
          reduced_price?: number | null
          seller_id: string
          seller_item_label?: string | null
          size?: string | null
          sold_at?: string | null
          sold_price?: number | null
          status?: Database["public"]["Enums"]["item_status"]
        }
        Update: {
          category?: string
          category_id?: string | null
          checked_in_at?: string | null
          created_at?: string
          custom_fields?: Json | null
          description?: string
          donate_if_unsold?: boolean
          enable_price_reduction?: boolean
          event_id?: string
          id?: string
          item_number?: string
          original_price?: number
          paid_at?: string | null
          price_reduction_times?: Json | null
          qr_code?: string
          reduced_price?: number | null
          seller_id?: string
          seller_item_label?: string | null
          size?: string | null
          sold_at?: string | null
          sold_price?: number | null
          status?: Database["public"]["Enums"]["item_status"]
        }
        Relationships: [
          {
            foreignKeyName: "items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "item_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          commission_rate: number
          created_at: string
          id: string
          name: string
          price_reduction_settings: Json | null
          slug: string
          vendor_commission_rate: number
        }
        Insert: {
          commission_rate?: number
          created_at?: string
          id?: string
          name: string
          price_reduction_settings?: Json | null
          slug: string
          vendor_commission_rate?: number
        }
        Update: {
          commission_rate?: number
          created_at?: string
          id?: string
          name?: string
          price_reduction_settings?: Json | null
          slug?: string
          vendor_commission_rate?: number
        }
        Relationships: []
      }
      organization_inventory_items: {
        Row: {
          id: string
          organization_id: string
          source_event_id: string | null
          source_item_id: string | null
          item_number_snapshot: string | null
          description: string
          category: string
          size: string | null
          origin_note: string | null
          status: string
          listed_price: number | null
          sale_price: number | null
          sold_at: string | null
          seller_of_record_id: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          source_event_id?: string | null
          source_item_id?: string | null
          item_number_snapshot?: string | null
          description: string
          category?: string
          size?: string | null
          origin_note?: string | null
          status?: string
          listed_price?: number | null
          sale_price?: number | null
          sold_at?: string | null
          seller_of_record_id?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          source_event_id?: string | null
          source_item_id?: string | null
          item_number_snapshot?: string | null
          description?: string
          category?: string
          size?: string | null
          origin_note?: string | null
          status?: string
          listed_price?: number | null
          sale_price?: number | null
          sold_at?: string | null
          seller_of_record_id?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      payouts: {
        Row: {
          check_number: string | null
          created_at: string
          event_id: string
          id: string
          issued_by: string
          items: string[]
          paid_at: string | null
          seller_id: string
          signed_by_seller: boolean
          total_amount: number
        }
        Insert: {
          check_number?: string | null
          created_at?: string
          event_id: string
          id?: string
          issued_by: string
          items?: string[]
          paid_at?: string | null
          seller_id: string
          signed_by_seller?: boolean
          total_amount: number
        }
        Update: {
          check_number?: string | null
          created_at?: string
          event_id?: string
          id?: string
          issued_by?: string
          items?: string[]
          paid_at?: string | null
          seller_id?: string
          signed_by_seller?: boolean
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "payouts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_swap_registrations: {
        Row: {
          event_id: string
          id: string
          is_complete: boolean
          registered_at: string
          registration_data: Json | null
          seller_id: string
          updated_at: string
        }
        Insert: {
          event_id: string
          id?: string
          is_complete?: boolean
          registered_at?: string
          registration_data?: Json | null
          seller_id: string
          updated_at?: string
        }
        Update: {
          event_id?: string
          id?: string
          is_complete?: boolean
          registered_at?: string
          registration_data?: Json | null
          seller_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_swap_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_swap_registrations_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      sellers: {
        Row: {
          access_token: string | null
          address: string | null
          address_line2: string | null
          auth_user_id: string | null
          city: string | null
          contact_info: Json | null
          country: string | null
          created_at: string
          email: string
          expo_push_token: string | null
          expo_push_token_updated_at: string | null
          first_name: string
          id: string
          is_guest: boolean
          last_name: string
          marketing_opt_in: boolean
          phone: string
          photo_id_verified: boolean
          photo_id_verified_at: string | null
          photo_id_verified_by: string | null
          profile_photo_url: string | null
          qr_code: string
          state: string | null
          zip_code: string | null
        }
        Insert: {
          access_token?: string | null
          address?: string | null
          address_line2?: string | null
          auth_user_id?: string | null
          city?: string | null
          contact_info?: Json | null
          country?: string | null
          created_at?: string
          email: string
          expo_push_token?: string | null
          expo_push_token_updated_at?: string | null
          first_name: string
          id: string
          is_guest?: boolean
          last_name: string
          marketing_opt_in?: boolean
          phone: string
          photo_id_verified?: boolean
          photo_id_verified_at?: string | null
          photo_id_verified_by?: string | null
          profile_photo_url?: string | null
          qr_code: string
          state?: string | null
          zip_code?: string | null
        }
        Update: {
          access_token?: string | null
          address?: string | null
          address_line2?: string | null
          auth_user_id?: string | null
          city?: string | null
          contact_info?: Json | null
          country?: string | null
          created_at?: string
          email?: string
          expo_push_token?: string | null
          expo_push_token_updated_at?: string | null
          first_name?: string
          id?: string
          is_guest?: boolean
          last_name?: string
          marketing_opt_in?: boolean
          phone?: string
          photo_id_verified?: boolean
          photo_id_verified_at?: string | null
          photo_id_verified_by?: string | null
          profile_photo_url?: string | null
          qr_code?: string
          state?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sellers_photo_id_verified_by_fkey"
            columns: ["photo_id_verified_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      swap_registration_field_definitions: {
        Row: {
          created_at: string
          default_value: string | null
          display_order: number
          field_type: Database["public"]["Enums"]["field_type"]
          help_text: string | null
          id: string
          is_optional: boolean
          is_required: boolean
          is_suggested_field: boolean
          label: string
          name: string
          options: Json | null
          organization_id: string
          placeholder: string | null
          suggested_field_type: string | null
          validation_rules: Json | null
        }
        Insert: {
          created_at?: string
          default_value?: string | null
          display_order?: number
          field_type: Database["public"]["Enums"]["field_type"]
          help_text?: string | null
          id?: string
          is_optional?: boolean
          is_required?: boolean
          is_suggested_field?: boolean
          label: string
          name: string
          options?: Json | null
          organization_id: string
          placeholder?: string | null
          suggested_field_type?: string | null
          validation_rules?: Json | null
        }
        Update: {
          created_at?: string
          default_value?: string | null
          display_order?: number
          field_type?: Database["public"]["Enums"]["field_type"]
          help_text?: string | null
          id?: string
          is_optional?: boolean
          is_required?: boolean
          is_suggested_field?: boolean
          label?: string
          name?: string
          options?: Json | null
          organization_id?: string
          placeholder?: string | null
          suggested_field_type?: string | null
          validation_rules?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "swap_registration_field_definitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      swap_registration_page_settings: {
        Row: {
          created_at: string
          custom_styles: Json | null
          field_groups: Json | null
          id: string
          organization_id: string
          page_description: string | null
          page_title: string
          updated_at: string
          welcome_message: string | null
        }
        Insert: {
          created_at?: string
          custom_styles?: Json | null
          field_groups?: Json | null
          id?: string
          organization_id: string
          page_description?: string | null
          page_title?: string
          updated_at?: string
          welcome_message?: string | null
        }
        Update: {
          created_at?: string
          custom_styles?: Json | null
          field_groups?: Json | null
          id?: string
          organization_id?: string
          page_description?: string | null
          page_title?: string
          updated_at?: string
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "swap_registration_page_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          buyer_contact_info: Json | null
          buyer_email: string | null
          buyer_name: string | null
          buyer_phone: string | null
          commission_amount: number
          event_id: string
          id: string
          item_id: string
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          processed_by: string
          seller_amount: number
          seller_id: string
          sold_at: string
          sold_price: number
        }
        Insert: {
          buyer_contact_info?: Json | null
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          commission_amount: number
          event_id: string
          id?: string
          item_id: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          processed_by: string
          seller_amount: number
          seller_id: string
          sold_at?: string
          sold_price: number
        }
        Update: {
          buyer_contact_info?: Json | null
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          commission_amount?: number
          event_id?: string
          id?: string
          item_id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          processed_by?: string
          seller_amount?: number
          seller_id?: string
          sold_at?: string
          sold_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "transactions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_can_access_event: { Args: { event_id: string }; Returns: boolean }
      get_user_organization_id: { Args: never; Returns: string }
      is_user_admin: { Args: never; Returns: boolean }
      org_user_can_access_event: {
        Args: { event_id: string }
        Returns: boolean
      }
      seller_delete_own_pending_item: {
        Args: { p_item_id: string }
        Returns: boolean
      }
      seller_has_items_in_event: {
        Args: { event_id: string }
        Returns: boolean
      }
      user_has_pickup_permission: { Args: never; Returns: boolean }
      user_has_pos_permission: { Args: never; Returns: boolean }
      user_is_admin_for_org: { Args: { org_id: string }; Returns: boolean }
      user_is_org_user_for_org: { Args: { org_id: string }; Returns: boolean }
    }
    Enums: {
      event_status: "active" | "closed"
      field_type:
        | "text"
        | "textarea"
        | "number"
        | "decimal"
        | "boolean"
        | "dropdown"
        | "date"
        | "time"
      item_status:
        | "pending"
        | "checked_in"
        | "for_sale"
        | "sold"
        | "picked_up"
        | "donated"
        | "donated_abandoned"
        | "unclaimed"
        | "withdrawn"
        | "lost"
        | "damaged"
      org_user_role: "admin" | "volunteer"
      payment_method: "cash" | "card" | "check"
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
      event_status: ["active", "closed"],
      field_type: [
        "text",
        "textarea",
        "number",
        "decimal",
        "boolean",
        "dropdown",
        "date",
        "time",
      ],
      item_status: [
        "pending",
        "checked_in",
        "for_sale",
        "sold",
        "picked_up",
        "donated",
        "donated_abandoned",
        "unclaimed",
        "withdrawn",
        "lost",
        "damaged",
      ],
      org_user_role: ["admin", "volunteer"],
      payment_method: ["cash", "card", "check"],
    },
  },
} as const
