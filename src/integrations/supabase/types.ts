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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          created_at: string
          detail: Json | null
          id: string
          library_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: string
          created_at?: string
          detail?: Json | null
          id?: string
          library_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          detail?: Json | null
          id?: string
          library_id?: string | null
        }
        Relationships: []
      }
      book_scan_jobs: {
        Row: {
          created_at: string
          created_by: string
          error_message: string | null
          extracted_data: Json | null
          id: string
          isbn: string | null
          library_id: string
          scan_method: string
          status: string
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          error_message?: string | null
          extracted_data?: Json | null
          id?: string
          isbn?: string | null
          library_id: string
          scan_method?: string
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          error_message?: string | null
          extracted_data?: Json | null
          id?: string
          isbn?: string | null
          library_id?: string
          scan_method?: string
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_scan_jobs_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries"
            referencedColumns: ["id"]
          },
        ]
      }
      books: {
        Row: {
          author: string | null
          availability_status: string
          category: string | null
          condition: string
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          isbn: string | null
          language: string | null
          library_id: string
          title: string
        }
        Insert: {
          author?: string | null
          availability_status?: string
          category?: string | null
          condition?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          isbn?: string | null
          language?: string | null
          library_id: string
          title: string
        }
        Update: {
          author?: string | null
          availability_status?: string
          category?: string | null
          condition?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          isbn?: string | null
          language?: string | null
          library_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "books_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries"
            referencedColumns: ["id"]
          },
        ]
      }
      deletion_requests: {
        Row: {
          created_at: string
          entity_id: string
          entity_label: string | null
          entity_type: string
          id: string
          library_id: string
          reason: string | null
          requested_by: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_label?: string | null
          entity_type: string
          id?: string
          library_id: string
          reason?: string | null
          requested_by: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_label?: string | null
          entity_type?: string
          id?: string
          library_id?: string
          reason?: string | null
          requested_by?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deletion_requests_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      invitations: {
        Row: {
          created_at: string
          email: string
          first_name: string | null
          id: string
          invited_by: string | null
          last_name: string | null
          library_id: string
          role: string
          status: string
          token: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name?: string | null
          id?: string
          invited_by?: string | null
          last_name?: string | null
          library_id: string
          role?: string
          status?: string
          token?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          invited_by?: string | null
          last_name?: string | null
          library_id?: string
          role?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries"
            referencedColumns: ["id"]
          },
        ]
      }
      libraries: {
        Row: {
          brand_color: string | null
          branding: Json
          contact_address: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          email_accent_color: string | null
          email_footer_text: string | null
          email_logo_url: string | null
          email_template_overrides: Json
          home_page_config: Json
          id: string
          languages: string[] | null
          logo_url: string | null
          name: string
          patron_portal_enabled: boolean
          published_at: string | null
          published_snapshot: Json | null
          status: string
          subdomain: string
          visibility: string
        }
        Insert: {
          brand_color?: string | null
          branding?: Json
          contact_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          email_accent_color?: string | null
          email_footer_text?: string | null
          email_logo_url?: string | null
          email_template_overrides?: Json
          home_page_config?: Json
          id?: string
          languages?: string[] | null
          logo_url?: string | null
          name: string
          patron_portal_enabled?: boolean
          published_at?: string | null
          published_snapshot?: Json | null
          status?: string
          subdomain: string
          visibility?: string
        }
        Update: {
          brand_color?: string | null
          branding?: Json
          contact_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          email_accent_color?: string | null
          email_footer_text?: string | null
          email_logo_url?: string | null
          email_template_overrides?: Json
          home_page_config?: Json
          id?: string
          languages?: string[] | null
          logo_url?: string | null
          name?: string
          patron_portal_enabled?: boolean
          published_at?: string | null
          published_snapshot?: Json | null
          status?: string
          subdomain?: string
          visibility?: string
        }
        Relationships: []
      }
      library_owner_invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          first_name: string | null
          id: string
          invited_by: string | null
          last_name: string | null
          library_id: string
          status: string
          token: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          first_name?: string | null
          id?: string
          invited_by?: string | null
          last_name?: string | null
          library_id: string
          status?: string
          token: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          first_name?: string | null
          id?: string
          invited_by?: string | null
          last_name?: string | null
          library_id?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_owner_invitations_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          book_id: string
          checked_out_at: string
          created_at: string
          due_date: string
          id: string
          library_id: string
          reader_id: string
          returned_at: string | null
          status: string
        }
        Insert: {
          book_id: string
          checked_out_at?: string
          created_at?: string
          due_date: string
          id?: string
          library_id: string
          reader_id: string
          returned_at?: string | null
          status?: string
        }
        Update: {
          book_id?: string
          checked_out_at?: string
          created_at?: string
          due_date?: string
          id?: string
          library_id?: string
          reader_id?: string
          returned_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_reader_id_fkey"
            columns: ["reader_id"]
            isOneToOne: false
            referencedRelation: "readers"
            referencedColumns: ["id"]
          },
        ]
      }
      member_invitations: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          library_id: string
          reader_id: string
          status: string
          token: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          library_id: string
          reader_id: string
          status?: string
          token: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          library_id?: string
          reader_id?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_invitations_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_invitations_reader_id_fkey"
            columns: ["reader_id"]
            isOneToOne: false
            referencedRelation: "readers"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admin_invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          first_name: string | null
          id: string
          invited_by: string | null
          last_name: string | null
          role: string
          status: string
          token: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          first_name?: string | null
          id?: string
          invited_by?: string | null
          last_name?: string | null
          role: string
          status?: string
          token: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          first_name?: string | null
          id?: string
          invited_by?: string | null
          last_name?: string | null
          role?: string
          status?: string
          token?: string
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          role?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: string
        }
        Relationships: []
      }
      platform_email_settings: {
        Row: {
          accent_color: string
          footer_text: string
          id: boolean
          invite_expiry_hours: number
          logo_url: string | null
          site_name: string
          template_overrides: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          accent_color?: string
          footer_text?: string
          id?: boolean
          invite_expiry_hours?: number
          logo_url?: string | null
          site_name?: string
          template_overrides?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          accent_color?: string
          footer_text?: string
          id?: boolean
          invite_expiry_hours?: number
          logo_url?: string | null
          site_name?: string
          template_overrides?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          id: boolean
          isbn_webhook_auth_header: string | null
          isbn_webhook_url: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          isbn_webhook_auth_header?: string | null
          isbn_webhook_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          isbn_webhook_auth_header?: string | null
          isbn_webhook_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      readers: {
        Row: {
          address: string | null
          auth_user_id: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          id_document_number: string | null
          id_document_type: string | null
          last_name: string
          library_id: string
          membership_number: string
          phone: string | null
          status: string
        }
        Insert: {
          address?: string | null
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          id_document_number?: string | null
          id_document_type?: string | null
          last_name: string
          library_id: string
          membership_number: string
          phone?: string | null
          status?: string
        }
        Update: {
          address?: string | null
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          id_document_number?: string | null
          id_document_type?: string | null
          last_name?: string
          library_id?: string
          membership_number?: string
          phone?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "readers_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          book_id: string
          created_at: string
          expires_at: string | null
          id: string
          library_id: string
          reader_id: string
          status: string
        }
        Insert: {
          book_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          library_id: string
          reader_id: string
          status?: string
        }
        Update: {
          book_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          library_id?: string
          reader_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_reader_id_fkey"
            columns: ["reader_id"]
            isOneToOne: false
            referencedRelation: "readers"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_users: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          library_id: string
          role: string
          status: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          library_id: string
          role?: string
          status?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          library_id?: string
          role?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_users_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries"
            referencedColumns: ["id"]
          },
        ]
      }
      support_sessions: {
        Row: {
          ended_at: string | null
          id: string
          library_id: string
          platform_admin_id: string
          reason: string | null
          started_at: string
        }
        Insert: {
          ended_at?: string | null
          id?: string
          library_id: string
          platform_admin_id: string
          reason?: string | null
          started_at?: string
        }
        Update: {
          ended_at?: string | null
          id?: string
          library_id?: string
          platform_admin_id?: string
          reason?: string | null
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_sessions_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_sessions_platform_admin_id_fkey"
            columns: ["platform_admin_id"]
            isOneToOne: false
            referencedRelation: "platform_admins"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_configs: {
        Row: {
          auth_header: string | null
          id: string
          is_active: boolean
          key: string
          updated_at: string
          updated_by: string
          url: string | null
        }
        Insert: {
          auth_header?: string | null
          id?: string
          is_active?: boolean
          key: string
          updated_at?: string
          updated_by: string
          url?: string | null
        }
        Update: {
          auth_header?: string | null
          id?: string
          is_active?: boolean
          key?: string
          updated_at?: string
          updated_by?: string
          url?: string | null
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _make_invite_token: { Args: never; Returns: string }
      accept_owner_invitation: {
        Args: {
          p_library_name?: string
          p_library_slug?: string
          p_token: string
        }
        Returns: {
          library_slug: string
        }[]
      }
      accept_platform_invitation: {
        Args: { p_token: string }
        Returns: undefined
      }
      accept_staff_invitation: {
        Args: { p_token: string }
        Returns: {
          library_slug: string
        }[]
      }
      active_support_library_id: { Args: never; Returns: string }
      approve_deletion_request: {
        Args: { p_id: string; p_note?: string }
        Returns: undefined
      }
      cancel_deletion_request: { Args: { p_id: string }; Returns: undefined }
      cancel_member_reservation: {
        Args: { p_reservation_id: string }
        Returns: undefined
      }
      cancel_reservation: {
        Args: { p_reservation_id: string }
        Returns: undefined
      }
      checkout_book: {
        Args: { p_book_id: string; p_due_date: string; p_reader_id: string }
        Returns: string
      }
      clear_isbn_webhook_config: { Args: never; Returns: undefined }
      create_library_for_current_user: {
        Args: { p_name: string; p_slug: string }
        Returns: string
      }
      create_member_invitation: {
        Args: { p_reader_id: string }
        Returns: string
      }
      current_tenant_role: { Args: { _library_id: string }; Returns: string }
      current_user_reader_id: { Args: never; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      disable_member_login: {
        Args: { p_reader_id: string }
        Returns: undefined
      }
      email_has_account: { Args: { p_email: string }; Returns: boolean }
      email_queue_dispatch: { Args: never; Returns: undefined }
      end_support_session: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_active_support_session: {
        Args: never
        Returns: {
          id: string
          library_id: string
          library_name: string
          library_slug: string
          reason: string
          started_at: string
        }[]
      }
      get_current_staff: {
        Args: never
        Returns: {
          email: string
          full_name: string
          id: string
          library_id: string
          library_name: string
          library_slug: string
          library_status: string
          role: string
          status: string
        }[]
      }
      get_effective_email_settings: {
        Args: { p_library_id?: string }
        Returns: Json
      }
      get_invitation_by_token: {
        Args: { p_token: string }
        Returns: {
          email: string
          first_name: string
          last_name: string
          library_name: string
          role: string
          status: string
        }[]
      }
      get_isbn_webhook_config: {
        Args: never
        Returns: {
          has_auth: boolean
          updated_at: string
          url: string
        }[]
      }
      get_library_by_slug: {
        Args: { p_slug: string }
        Returns: {
          brand_color: string
          branding: Json
          id: string
          logo_url: string
          name: string
          subdomain: string
        }[]
      }
      get_library_public_home: {
        Args: { p_slug: string }
        Returns: {
          brand_color: string
          branding: Json
          contact_address: string
          contact_email: string
          contact_phone: string
          home_page_config: Json
          id: string
          languages: string[]
          logo_url: string
          name: string
          patron_portal_enabled: boolean
          published_at: string
          published_snapshot: Json
          status: string
          subdomain: string
          visibility: string
        }[]
      }
      get_member_invitation_preview: {
        Args: { p_token: string }
        Returns: {
          expired: boolean
          library_name: string
          library_slug: string
          portal_enabled: boolean
          reader_first_name: string
          reader_last_name: string
          status: string
        }[]
      }
      get_my_member_dashboard: { Args: { p_slug: string }; Returns: Json }
      get_owner_invitation_by_token: {
        Args: { p_token: string }
        Returns: {
          email: string
          expired: boolean
          first_name: string
          last_name: string
          library_name: string
          library_slug: string
          status: string
        }[]
      }
      get_platform_invitation_by_token: {
        Args: { p_token: string }
        Returns: {
          email: string
          expired: boolean
          first_name: string
          last_name: string
          role: string
          status: string
        }[]
      }
      get_platform_overview: { Args: never; Returns: Json }
      get_reader_member_status: {
        Args: { p_reader_id: string }
        Returns: {
          has_login: boolean
          pending_expires_at: string
          pending_invitation_id: string
          pending_token: string
        }[]
      }
      get_tenant_context: {
        Args: { p_library_id: string }
        Returns: {
          is_platform_admin: boolean
          is_support: boolean
          library_status: string
          role: string
        }[]
      }
      get_user_library_id: { Args: never; Returns: string }
      has_capability: {
        Args: { _cap: string; _library_id: string }
        Returns: boolean
      }
      in_tenant_scope: { Args: { _library_id: string }; Returns: boolean }
      is_owner: { Args: never; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      is_platform_owner: { Args: never; Returns: boolean }
      is_platform_super_admin: { Args: never; Returns: boolean }
      link_member_account: {
        Args: { p_token: string }
        Returns: {
          library_slug: string
          reader_id: string
        }[]
      }
      list_deletion_requests: {
        Args: { p_library_id: string; p_status?: string }
        Returns: {
          created_at: string
          entity_id: string
          entity_label: string
          entity_type: string
          id: string
          reason: string
          requested_by: string
          requester_email: string
          requester_name: string
          review_note: string
          reviewed_at: string
          reviewed_by: string
          reviewer_name: string
          status: string
        }[]
      }
      member_portal_open: { Args: { _library_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      patch_library_email_settings: {
        Args: { p_library_id: string; p_patch: Json }
        Returns: undefined
      }
      patch_platform_email_settings: {
        Args: { p_patch: Json }
        Returns: undefined
      }
      place_reservation: {
        Args: { p_book_id: string; p_expires_at?: string; p_reader_id: string }
        Returns: string
      }
      platform_delete_library: {
        Args: { p_library_id: string }
        Returns: undefined
      }
      platform_delete_user: { Args: { p_user_id: string }; Returns: undefined }
      platform_grant_role: {
        Args: { p_email: string; p_role: string }
        Returns: string
      }
      platform_invite_admin: {
        Args: {
          p_email: string
          p_first_name?: string
          p_last_name?: string
          p_role: string
        }
        Returns: {
          invitation_id: string
          token: string
        }[]
      }
      platform_invite_library_owner: {
        Args: {
          p_email: string
          p_first_name?: string
          p_last_name?: string
          p_name: string
          p_slug: string
        }
        Returns: {
          invitation_id: string
          library_id: string
          token: string
        }[]
      }
      platform_list_admin_invites: {
        Args: never
        Returns: {
          created_at: string
          email: string
          expires_at: string
          id: string
          role: string
          status: string
          token: string
        }[]
      }
      platform_list_admins: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          role: string
        }[]
      }
      platform_list_all_users: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          last_sign_in_at: string
          library_memberships: Json
          platform_role: string
        }[]
      }
      platform_list_libraries: {
        Args: never
        Returns: {
          book_count: number
          created_at: string
          id: string
          name: string
          reader_count: number
          staff_count: number
          status: string
          subdomain: string
        }[]
      }
      platform_list_library_owner_invites: {
        Args: never
        Returns: {
          created_at: string
          email: string
          expires_at: string
          id: string
          library_id: string
          library_name: string
          library_slug: string
          status: string
          token: string
        }[]
      }
      platform_revoke_admin_invite: {
        Args: { p_id: string }
        Returns: undefined
      }
      platform_revoke_library_owner_invite: {
        Args: { p_id: string }
        Returns: undefined
      }
      platform_revoke_role: { Args: { p_user_id: string }; Returns: undefined }
      platform_set_library_status: {
        Args: { p_library_id: string; p_status: string }
        Returns: undefined
      }
      publish_library: { Args: { p_library_id: string }; Returns: string }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      reject_deletion_request: {
        Args: { p_id: string; p_note?: string }
        Returns: undefined
      }
      renew_member_loan: { Args: { p_loan_id: string }; Returns: string }
      request_entity_deletion: {
        Args: { p_entity_id: string; p_entity_type: string; p_reason?: string }
        Returns: Json
      }
      return_loan: { Args: { p_loan_id: string }; Returns: undefined }
      revoke_member_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      set_book_condition: {
        Args: { p_book_id: string; p_condition: string }
        Returns: undefined
      }
      set_isbn_webhook_config: {
        Args: { p_auth_header: string; p_url: string }
        Returns: undefined
      }
      set_library_visibility: {
        Args: { p_library_id: string; p_visibility: string }
        Returns: undefined
      }
      set_reader_status: {
        Args: { p_reader_id: string; p_status: string }
        Returns: undefined
      }
      staff_role_rank: { Args: { _role: string }; Returns: number }
      start_support_session: {
        Args: { p_library_id: string; p_reason: string }
        Returns: string
      }
      update_library_slug: { Args: { p_slug: string }; Returns: string }
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
