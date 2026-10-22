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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      analysis_batches: {
        Row: {
          batch_key: string
          created_at: string
          result: Json
          user_id: string
        }
        Insert: {
          batch_key: string
          created_at?: string
          result: Json
          user_id: string
        }
        Update: {
          batch_key?: string
          created_at?: string
          result?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_batches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_runs: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      external_suggestions: {
        Row: {
          citations: number
          created_at: string
          h_index: number
          id: string
          institution: string | null
          layer: string
          name: string
          openalex_id: string
          recent_works: number | null
          score: number
          shared_topics: string[]
          state: string
          t: number
          updated_at: string
          user_id: string
          via: string | null
          works_count: number
        }
        Insert: {
          citations?: number
          created_at?: string
          h_index?: number
          id?: string
          institution?: string | null
          layer?: string
          name: string
          openalex_id: string
          recent_works?: number | null
          score: number
          shared_topics?: string[]
          state?: string
          t: number
          updated_at?: string
          user_id: string
          via?: string | null
          works_count?: number
        }
        Update: {
          citations?: number
          created_at?: string
          h_index?: number
          id?: string
          institution?: string | null
          layer?: string
          name?: string
          openalex_id?: string
          recent_works?: number | null
          score?: number
          shared_topics?: string[]
          state?: string
          t?: number
          updated_at?: string
          user_id?: string
          via?: string | null
          works_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "external_suggestions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          created_at: string
          id: string
          target_id: string
          target_type: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          target_id: string
          target_type: string
          user_id: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          target_id?: string
          target_type?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      interests: {
        Row: {
          created_at: string
          match_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          match_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          match_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interests_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      job_state: {
        Row: {
          last_result: Json | null
          last_run_at: string | null
          locked_until: string | null
          name: string
          paused_at: string | null
          paused_reason: string | null
        }
        Insert: {
          last_result?: Json | null
          last_run_at?: string | null
          locked_until?: string | null
          name: string
          paused_at?: string | null
          paused_reason?: string | null
        }
        Update: {
          last_result?: Json | null
          last_run_at?: string | null
          locked_until?: string | null
          name?: string
          paused_at?: string | null
          paused_reason?: string | null
        }
        Relationships: []
      }
      match_user_state: {
        Row: {
          ideas: Json
          ideas_at: string | null
          match_id: string
          notes: string
          notes_updated_at: string | null
          state: string
          summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ideas?: Json
          ideas_at?: string | null
          match_id: string
          notes?: string
          notes_updated_at?: string | null
          state?: string
          summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ideas?: Json
          ideas_at?: string | null
          match_id?: string
          notes?: string
          notes_updated_at?: string | null
          state?: string
          summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_user_state_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          a_only: string[]
          act: number
          b_only: string[]
          created_at: string
          formula: string
          id: string
          layer: string
          m: number
          score: number
          shared_methods: string[]
          shared_topics: string[]
          t: number
          user_a: string
          user_b: string
          via: string | null
        }
        Insert: {
          a_only?: string[]
          act: number
          b_only?: string[]
          created_at?: string
          formula?: string
          id?: string
          layer?: string
          m: number
          score: number
          shared_methods?: string[]
          shared_topics?: string[]
          t: number
          user_a: string
          user_b: string
          via?: string | null
        }
        Update: {
          a_only?: string[]
          act?: number
          b_only?: string[]
          created_at?: string
          formula?: string
          id?: string
          layer?: string
          m?: number
          score?: number
          shared_methods?: string[]
          shared_topics?: string[]
          t?: number
          user_a?: string
          user_b?: string
          via?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_user_a_fkey"
            columns: ["user_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_user_b_fkey"
            columns: ["user_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      openalex_cache: {
        Row: {
          body: Json
          fetched_at: string
          url: string
        }
        Insert: {
          body: Json
          fetched_at?: string
          url: string
        }
        Update: {
          body?: Json
          fetched_at?: string
          url?: string
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          created_at: string
          dropped_claims: Json
          settings: Json
          suggestions: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          dropped_claims?: Json
          settings?: Json
          suggestions?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          dropped_claims?: Json
          settings?: Json
          suggestions?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_analysis: {
        Row: {
          directions: Json
          dropped_claims: Json
          error: string | null
          finished_at: string | null
          input_hash: string | null
          interests: Json
          methods: Json
          status: string
          summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          directions?: Json
          dropped_claims?: Json
          error?: string | null
          finished_at?: string | null
          input_hash?: string | null
          interests?: Json
          methods?: Json
          status?: string
          summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          directions?: Json
          dropped_claims?: Json
          error?: string | null
          finished_at?: string | null
          input_hash?: string | null
          interests?: Json
          methods?: Json
          status?: string
          summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_analysis_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_analysis_edits: {
        Row: {
          action: string
          created_at: string
          id: string
          kind: string
          user_id: string
          value: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          kind: string
          user_id: string
          value: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          kind?: string
          user_id?: string
          value?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activity: number
          created_at: string
          custom_topics: string[]
          first_name: string
          id: string
          institution: string | null
          last_imported_at: string | null
          last_name: string
          match_weights: Json | null
          openalex_author_id: string | null
          openalex_author_ids: string[]
          orcid: string | null
          research_interests: string | null
          timezone: string | null
          topic_weights: Json
          updated_at: string
          works_truncated: boolean
        }
        Insert: {
          activity?: number
          created_at?: string
          custom_topics?: string[]
          first_name?: string
          id: string
          institution?: string | null
          last_imported_at?: string | null
          last_name?: string
          match_weights?: Json | null
          openalex_author_id?: string | null
          openalex_author_ids?: string[]
          orcid?: string | null
          research_interests?: string | null
          timezone?: string | null
          topic_weights?: Json
          updated_at?: string
          works_truncated?: boolean
        }
        Update: {
          activity?: number
          created_at?: string
          custom_topics?: string[]
          first_name?: string
          id?: string
          institution?: string | null
          last_imported_at?: string | null
          last_name?: string
          match_weights?: Json | null
          openalex_author_id?: string | null
          openalex_author_ids?: string[]
          orcid?: string | null
          research_interests?: string | null
          timezone?: string | null
          topic_weights?: Json
          updated_at?: string
          works_truncated?: boolean
        }
        Relationships: []
      }
      saved_opportunities: {
        Row: {
          created_at: string
          id: string
          notes: string
          notes_updated_at: string | null
          snapshot: Json
          source_key: string
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string
          notes_updated_at?: string | null
          snapshot?: Json
          source_key: string
          state?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string
          notes_updated_at?: string | null
          snapshot?: Json
          source_key?: string
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_opportunities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      works: {
        Row: {
          authors: Json
          cited_by_count: number
          created_at: string
          doi: string | null
          id: string
          is_oa: boolean
          keywords: Json
          openalex_id: string
          title: string
          topics: Json
          type: string | null
          user_id: string
          venue: string | null
          year: number | null
        }
        Insert: {
          authors?: Json
          cited_by_count?: number
          created_at?: string
          doi?: string | null
          id?: string
          is_oa?: boolean
          keywords?: Json
          openalex_id: string
          title: string
          topics?: Json
          type?: string | null
          user_id: string
          venue?: string | null
          year?: number | null
        }
        Update: {
          authors?: Json
          cited_by_count?: number
          created_at?: string
          doi?: string | null
          id?: string
          is_oa?: boolean
          keywords?: Json
          openalex_id?: string
          title?: string
          topics?: Json
          type?: string | null
          user_id?: string
          venue?: string | null
          year?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_cards: {
        Args: never
        Returns: {
          citations: number
          directions: string[]
          h_index: number
          interests: string
          methods: string[]
          openalex_ids: string[]
          other_id: string
          recent_works: number
          works_count: number
        }[]
      }
      my_matches: {
        Args: never
        Returns: {
          act: number
          created_at: string
          formula: string
          i_am_interested: boolean
          id: string
          m: number
          other_email: string
          other_id: string
          other_institution: string
          other_name: string
          score: number
          shared_methods: string[]
          shared_topics: string[]
          t: number
          they_are_interested: boolean
          they_bring: string[]
          you_bring: string[]
        }[]
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
