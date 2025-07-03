import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Client for browser/frontend operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Admin client for server-side operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Database types
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          wallet_address: string
          public_key: string
          created_at: string
          updated_at: string
          last_seen: string
          is_online: boolean
        }
        Insert: {
          id?: string
          wallet_address: string
          public_key: string
          created_at?: string
          updated_at?: string
          last_seen?: string
          is_online?: boolean
        }
        Update: {
          id?: string
          wallet_address?: string
          public_key?: string
          created_at?: string
          updated_at?: string
          last_seen?: string
          is_online?: boolean
        }
      }
      rooms: {
        Row: {
          id: string
          name: string
          description: string | null
          created_by: string
          created_at: string
          updated_at: string
          is_private: boolean
          room_type: 'direct' | 'group' | 'public'
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
          is_private?: boolean
          room_type?: 'direct' | 'group' | 'public'
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
          is_private?: boolean
          room_type?: 'direct' | 'group' | 'public'
        }
      }
      room_members: {
        Row: {
          id: string
          room_id: string
          user_id: string
          joined_at: string
          role: 'admin' | 'member'
          is_active: boolean
        }
        Insert: {
          id?: string
          room_id: string
          user_id: string
          joined_at?: string
          role?: 'admin' | 'member'
          is_active?: boolean
        }
        Update: {
          id?: string
          room_id?: string
          user_id?: string
          joined_at?: string
          role?: 'admin' | 'member'
          is_active?: boolean
        }
      }
      messages: {
        Row: {
          id: string
          room_id: string
          sender_id: string
          encrypted_content: string
          message_type: 'text' | 'media' | 'file'
          created_at: string
          updated_at: string
          edited_at: string | null
          is_deleted: boolean
          reply_to: string | null
          blockchain_hash: string | null
          media_url: string | null
          media_type: string | null
          media_hash: string | null
        }
        Insert: {
          id?: string
          room_id: string
          sender_id: string
          encrypted_content: string
          message_type?: 'text' | 'media' | 'file'
          created_at?: string
          updated_at?: string
          edited_at?: string | null
          is_deleted?: boolean
          reply_to?: string | null
          blockchain_hash?: string | null
          media_url?: string | null
          media_type?: string | null
          media_hash?: string | null
        }
        Update: {
          id?: string
          room_id?: string
          sender_id?: string
          encrypted_content?: string
          message_type?: 'text' | 'media' | 'file'
          created_at?: string
          updated_at?: string
          edited_at?: string | null
          is_deleted?: boolean
          reply_to?: string | null
          blockchain_hash?: string | null
          media_url?: string | null
          media_type?: string | null
          media_hash?: string | null
        }
      }
      message_reactions: {
        Row: {
          id: string
          message_id: string
          user_id: string
          emoji: string
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          user_id: string
          emoji: string
          created_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          user_id?: string
          emoji?: string
          created_at?: string
        }
      }
      message_reads: {
        Row: {
          id: string
          message_id: string
          user_id: string
          read_at: string
        }
        Insert: {
          id?: string
          message_id: string
          user_id: string
          read_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          user_id?: string
          read_at?: string
        }
      }
      media: {
        Row: {
          id: string
          user_id: string
          file_name: string
          file_type: string
          file_size: number
          file_path: string
          file_url: string
          file_hash: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          file_name: string
          file_type: string
          file_size: number
          file_path: string
          file_url: string
          file_hash: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          file_name?: string
          file_type?: string
          file_size?: number
          file_path?: string
          file_url?: string
          file_hash?: string
          created_at?: string
        }
      }
    }
  }
}
