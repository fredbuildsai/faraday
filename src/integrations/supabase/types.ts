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
          vias: string[]
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
          vias?: string[]
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
          vias?: string[]
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
          vias: string[]
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
          vias?: string[]
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
          vias?: string[]
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
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          project_id: string | null
          read: boolean
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind: string
          project_id?: string | null
          read?: boolean
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          project_id?: string | null
          read?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
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
          research_settings: Json
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
          research_settings?: Json
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
          research_settings?: Json
          timezone?: string | null
          topic_weights?: Json
          updated_at?: string
          works_truncated?: boolean
        }
        Relationships: []
      }
      project_activity: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          detail: Json
          id: string
          project_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          project_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_activity_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          paper_id: string | null
          project_id: string
          resolved: boolean
          section_id: string | null
        }
        Insert: {
          author_id?: string
          body: string
          created_at?: string
          id?: string
          paper_id?: string | null
          project_id: string
          resolved?: boolean
          section_id?: string | null
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          paper_id?: string | null
          project_id?: string
          resolved?: boolean
          section_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_comments_paper_id_fkey"
            columns: ["paper_id"]
            isOneToOne: false
            referencedRelation: "project_papers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_comments_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "project_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          invited_by: string | null
          project_id: string
          role: string
          state: string
          user_id: string
        }
        Insert: {
          created_at?: string
          invited_by?: string | null
          project_id: string
          role?: string
          state?: string
          user_id: string
        }
        Update: {
          created_at?: string
          invited_by?: string | null
          project_id?: string
          role?: string
          state?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_papers: {
        Row: {
          added_by: string
          created_at: string
          id: string
          is_oa: boolean
          openalex_id: string
          origin: string
          project_id: string
          title: string
          url: string | null
        }
        Insert: {
          added_by?: string
          created_at?: string
          id?: string
          is_oa?: boolean
          openalex_id: string
          origin?: string
          project_id: string
          title: string
          url?: string | null
        }
        Update: {
          added_by?: string
          created_at?: string
          id?: string
          is_oa?: boolean
          openalex_id?: string
          origin?: string
          project_id?: string
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_papers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_section_versions: {
        Row: {
          body: string
          created_at: string
          edited_by: string | null
          id: string
          project_id: string
          section_id: string
          version: number
        }
        Insert: {
          body: string
          created_at?: string
          edited_by?: string | null
          id?: string
          project_id: string
          section_id: string
          version: number
        }
        Update: {
          body?: string
          created_at?: string
          edited_by?: string | null
          id?: string
          project_id?: string
          section_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_section_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_section_versions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "project_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      project_sections: {
        Row: {
          body: string
          id: string
          key: string
          position: number
          project_id: string
          title: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          body?: string
          id?: string
          key: string
          position?: number
          project_id: string
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          body?: string
          id?: string
          key?: string
          position?: number
          project_id?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_sections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tasks: {
        Row: {
          assignee_id: string | null
          created_at: string
          created_by: string
          done: boolean
          due_date: string | null
          id: string
          project_id: string
          title: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string
          done?: boolean
          due_date?: string | null
          id?: string
          project_id: string
          title: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string
          done?: boolean
          due_date?: string | null
          id?: string
          project_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          archived: boolean
          created_at: string
          description: string
          id: string
          owner_id: string
          source: Json
          status: string
          suggested_people: Json
          title: string
          updated_at: string
          whitespace: Json | null
        }
        Insert: {
          archived?: boolean
          created_at?: string
          description?: string
          id?: string
          owner_id: string
          source?: Json
          status?: string
          suggested_people?: Json
          title: string
          updated_at?: string
          whitespace?: Json | null
        }
        Update: {
          archived?: boolean
          created_at?: string
          description?: string
          id?: string
          owner_id?: string
          source?: Json
          status?: string
          suggested_people?: Json
          title?: string
          updated_at?: string
          whitespace?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      actor_name: { Args: { _user: string }; Returns: string }
      delete_project: { Args: { _project: string }; Returns: undefined }
      is_project_invitee: {
        Args: { _project: string; _user: string }
        Returns: boolean
      }
      is_project_member: {
        Args: { _project: string; _user: string }
        Returns: boolean
      }
      is_project_owner: {
        Args: { _project: string; _user: string }
        Returns: boolean
      }
      leave_project: { Args: { _project: string }; Returns: undefined }
      log_project: {
        Args: {
          _action: string
          _actor: string
          _detail: Json
          _notify: string
          _project: string
        }
        Returns: undefined
      }
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
      project_people: {
        Args: { _project: string }
        Returns: {
          institution: string
          name: string
          role: string
          state: string
          user_id: string
        }[]
      }
      remove_project_member: {
        Args: { _project: string; _user: string }
        Returns: undefined
      }
      respond_project_invite: {
        Args: { _accept: boolean; _project: string }
        Returns: undefined
      }
      save_project_section: {
        Args: { _body: string; _expected_version: number; _section: string }
        Returns: number
      }
      transfer_project_ownership: {
        Args: { _project: string; _user: string }
        Returns: undefined
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
