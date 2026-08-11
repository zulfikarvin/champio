/**
 * Database types for Champio.
 *
 * Hand-authored to match supabase/migrations/0001_schema.sql exactly, in the same
 * shape `supabase gen types typescript` emits — so once the hosted project is
 * reachable, `npm run db:types` overwrites this file as a drop-in replacement.
 *
 * Two things follow the generator's conventions rather than what looks tidier:
 *   - `Update` lists every column as optional, even ones no policy lets a client
 *     change. Write access is decided by RLS, not by the type system.
 *   - `Relationships` is populated, because PostgREST embedded selects
 *     (`select("*, teams(name)")`) are resolved through it. An empty array makes
 *     every join fail to typecheck.
 *
 * Application code should import from `@/lib/db`, not from this file — see the
 * note there.
 */

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
          university: string | null;
          is_admin: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          university?: string | null;
          is_admin?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          university?: string | null;
          is_admin?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      teams: {
        Row: {
          id: string;
          name: string;
          university: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          university?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          university?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      team_members: {
        Row: {
          team_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["team_role"];
          created_at: string;
        };
        Insert: {
          team_id: string;
          user_id: string;
          role?: Database["public"]["Enums"]["team_role"];
          created_at?: string;
        };
        Update: {
          team_id?: string;
          user_id?: string;
          role?: Database["public"]["Enums"]["team_role"];
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tracks: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      learning_modules: {
        Row: {
          id: string;
          track_id: string;
          order_index: number;
          title: string;
          content_md: string;
          est_minutes: number;
          is_draft: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          track_id: string;
          order_index: number;
          title: string;
          content_md?: string;
          est_minutes?: number;
          is_draft?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          track_id?: string;
          order_index?: number;
          title?: string;
          content_md?: string;
          est_minutes?: number;
          is_draft?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "learning_modules_track_id_fkey";
            columns: ["track_id"];
            isOneToOne: false;
            referencedRelation: "tracks";
            referencedColumns: ["id"];
          },
        ];
      };
      quizzes: {
        Row: {
          id: string;
          module_id: string;
          questions_json: Json;
          /**
           * SELECT on this column is REVOKED from `anon` and `authenticated`
           * (migration 0002). It is readable only through the service-role
           * client. Selecting `*` from a user-scoped client will ERROR — name
           * your columns explicitly in client code.
           */
          answer_key_json: Json;
          pass_threshold: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          module_id: string;
          questions_json?: Json;
          answer_key_json?: Json;
          pass_threshold?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          module_id?: string;
          questions_json?: Json;
          answer_key_json?: Json;
          pass_threshold?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quizzes_module_id_fkey";
            columns: ["module_id"];
            isOneToOne: true;
            referencedRelation: "learning_modules";
            referencedColumns: ["id"];
          },
        ];
      };
      quiz_attempts: {
        Row: {
          id: string;
          user_id: string;
          quiz_id: string;
          score: number;
          passed: boolean;
          answers_json: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          quiz_id: string;
          score: number;
          passed: boolean;
          answers_json?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          quiz_id?: string;
          score?: number;
          passed?: boolean;
          answers_json?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey";
            columns: ["quiz_id"];
            isOneToOne: false;
            referencedRelation: "quizzes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quiz_attempts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      reference_papers: {
        Row: {
          id: string;
          track_id: string | null;
          title: string;
          competition_name: string | null;
          year: number | null;
          summary: string | null;
          file_path: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          track_id?: string | null;
          title: string;
          competition_name?: string | null;
          year?: number | null;
          summary?: string | null;
          file_path: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          track_id?: string | null;
          title?: string;
          competition_name?: string | null;
          year?: number | null;
          summary?: string | null;
          file_path?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reference_papers_track_id_fkey";
            columns: ["track_id"];
            isOneToOne: false;
            referencedRelation: "tracks";
            referencedColumns: ["id"];
          },
        ];
      };
      rubrics: {
        Row: {
          id: string;
          team_id: string | null;
          track_id: string;
          name: string;
          source: Database["public"]["Enums"]["rubric_source"];
          schema_json: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id?: string | null;
          track_id: string;
          name: string;
          source: Database["public"]["Enums"]["rubric_source"];
          schema_json: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string | null;
          track_id?: string;
          name?: string;
          source?: Database["public"]["Enums"]["rubric_source"];
          schema_json?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rubrics_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rubrics_track_id_fkey";
            columns: ["track_id"];
            isOneToOne: false;
            referencedRelation: "tracks";
            referencedColumns: ["id"];
          },
        ];
      };
      guidebooks: {
        Row: {
          id: string;
          team_id: string;
          uploaded_by: string | null;
          file_name: string | null;
          file_path: string;
          status: Database["public"]["Enums"]["guidebook_status"];
          rubric_id: string | null;
          error: string | null;
          /** Compiled rubric draft awaiting review (migration 0008). */
          compiled_json: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          uploaded_by?: string | null;
          file_name?: string | null;
          file_path: string;
          status?: Database["public"]["Enums"]["guidebook_status"];
          rubric_id?: string | null;
          error?: string | null;
          compiled_json?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          uploaded_by?: string | null;
          file_name?: string | null;
          file_path?: string;
          status?: Database["public"]["Enums"]["guidebook_status"];
          rubric_id?: string | null;
          error?: string | null;
          compiled_json?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "guidebooks_rubric_id_fkey";
            columns: ["rubric_id"];
            isOneToOne: false;
            referencedRelation: "rubrics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "guidebooks_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "guidebooks_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      proposals: {
        Row: {
          id: string;
          team_id: string;
          track_id: string;
          rubric_id: string;
          title: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          track_id: string;
          rubric_id: string;
          title: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          track_id?: string;
          rubric_id?: string;
          title?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "proposals_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "proposals_rubric_id_fkey";
            columns: ["rubric_id"];
            isOneToOne: false;
            referencedRelation: "rubrics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "proposals_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "proposals_track_id_fkey";
            columns: ["track_id"];
            isOneToOne: false;
            referencedRelation: "tracks";
            referencedColumns: ["id"];
          },
        ];
      };
      proposal_versions: {
        Row: {
          id: string;
          proposal_id: string;
          team_id: string;
          version_number: number;
          file_path: string;
          file_type: Database["public"]["Enums"]["submission_file_type"];
          extracted_text: string | null;
          extracted_meta: Json;
          created_by: string | null;
          created_at: string;
        };
        /**
         * `team_id` is overwritten by the inherit_team_id_from_proposal trigger,
         * so whatever a caller sends is discarded. It stays required here to
         * mirror the generated output; pass the parent's id for readability.
         */
        Insert: {
          id?: string;
          proposal_id: string;
          team_id: string;
          version_number: number;
          file_path: string;
          file_type: Database["public"]["Enums"]["submission_file_type"];
          extracted_text?: string | null;
          extracted_meta?: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          proposal_id?: string;
          team_id?: string;
          version_number?: number;
          file_path?: string;
          file_type?: Database["public"]["Enums"]["submission_file_type"];
          extracted_text?: string | null;
          extracted_meta?: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "proposal_versions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "proposal_versions_proposal_id_fkey";
            columns: ["proposal_id"];
            isOneToOne: false;
            referencedRelation: "proposals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "proposal_versions_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      evaluations: {
        Row: {
          id: string;
          proposal_version_id: string;
          team_id: string;
          rubric_id: string;
          status: Database["public"]["Enums"]["evaluation_status"];
          started_at: string | null;
          completed_at: string | null;
          overall_score: number | null;
          result_json: Json | null;
          token_input: number;
          token_output: number;
          cost_usd: number;
          error: string | null;
          prompt_version: string | null;
          /** Pinned model id that produced this result (migration 0005). */
          model: string | null;
          attempt_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          proposal_version_id: string;
          team_id: string;
          rubric_id: string;
          status?: Database["public"]["Enums"]["evaluation_status"];
          started_at?: string | null;
          completed_at?: string | null;
          overall_score?: number | null;
          result_json?: Json | null;
          token_input?: number;
          token_output?: number;
          cost_usd?: number;
          error?: string | null;
          prompt_version?: string | null;
          model?: string | null;
          attempt_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          proposal_version_id?: string;
          team_id?: string;
          rubric_id?: string;
          status?: Database["public"]["Enums"]["evaluation_status"];
          started_at?: string | null;
          completed_at?: string | null;
          overall_score?: number | null;
          result_json?: Json | null;
          token_input?: number;
          token_output?: number;
          cost_usd?: number;
          error?: string | null;
          prompt_version?: string | null;
          model?: string | null;
          attempt_count?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "evaluations_proposal_version_id_fkey";
            columns: ["proposal_version_id"];
            isOneToOne: false;
            referencedRelation: "proposal_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evaluations_rubric_id_fkey";
            columns: ["rubric_id"];
            isOneToOne: false;
            referencedRelation: "rubrics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evaluations_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      competition_results: {
        Row: {
          id: string;
          team_id: string;
          proposal_id: string | null;
          competition_name: string;
          stage_reached: string | null;
          placement: string | null;
          reported_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          proposal_id?: string | null;
          competition_name: string;
          stage_reached?: string | null;
          placement?: string | null;
          reported_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          proposal_id?: string | null;
          competition_name?: string;
          stage_reached?: string | null;
          placement?: string | null;
          reported_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "competition_results_proposal_id_fkey";
            columns: ["proposal_id"];
            isOneToOne: false;
            referencedRelation: "proposals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "competition_results_reported_by_fkey";
            columns: ["reported_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "competition_results_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          id: number;
          user_id: string | null;
          team_id: string | null;
          event_name: string;
          properties_json: Json;
          created_at: string;
        };
        Insert: {
          id?: never;
          user_id?: string | null;
          team_id?: string | null;
          event_name: string;
          properties_json?: Json;
          created_at?: string;
        };
        Update: {
          id?: never;
          user_id?: string | null;
          team_id?: string | null;
          event_name?: string;
          properties_json?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "events_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      is_team_member: { Args: { t: string }; Returns: boolean };
      is_team_owner: { Args: { t: string }; Returns: boolean };
      shares_team_with: { Args: { u: string }; Returns: boolean };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      rubric_is_unused: { Args: { r: string }; Returns: boolean };
      team_id_from_path: { Args: { object_name: string }; Returns: string | null };
    };
    Enums: {
      team_role: "owner" | "member";
      rubric_source: "default" | "compiled_from_guidebook";
      guidebook_status: "uploaded" | "compiling" | "complete" | "failed";
      evaluation_status:
        | "queued"
        | "extracting"
        | "evaluating"
        | "complete"
        | "failed";
      submission_file_type: "pdf" | "pptx";
    };
    CompositeTypes: Record<never, never>;
  };
};
