# Database Schema Documentation

## Overview
The SocketChat application uses Supabase (PostgreSQL) as its primary database with the following core tables:

## Core Tables

### `users`
Stores user authentication and profile information.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL UNIQUE,
    public_key TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_online BOOLEAN DEFAULT false
);

-- Indexes
CREATE INDEX idx_users_wallet_address ON users(wallet_address);
CREATE INDEX idx_users_is_online ON users(is_online);
CREATE INDEX idx_users_last_seen ON users(last_seen);
```

### `rooms`
Stores chat room information.

```sql
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_private BOOLEAN DEFAULT false,
    room_type TEXT CHECK (room_type IN ('direct', 'group', 'public')) DEFAULT 'group'
);

-- Indexes
CREATE INDEX idx_rooms_created_by ON rooms(created_by);
CREATE INDEX idx_rooms_room_type ON rooms(room_type);
CREATE INDEX idx_rooms_is_private ON rooms(is_private);
CREATE INDEX idx_rooms_updated_at ON rooms(updated_at);
```

### `room_members`
Stores room membership information.

```sql
CREATE TABLE room_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    role TEXT CHECK (role IN ('admin', 'member')) DEFAULT 'member',
    is_active BOOLEAN DEFAULT true,
    UNIQUE(room_id, user_id)
);

-- Indexes
CREATE INDEX idx_room_members_room_id ON room_members(room_id);
CREATE INDEX idx_room_members_user_id ON room_members(user_id);
CREATE INDEX idx_room_members_is_active ON room_members(is_active);
```

### `messages`
Stores chat messages with encryption support.

```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    encrypted_content TEXT NOT NULL,
    message_type TEXT CHECK (message_type IN ('text', 'media', 'file')) DEFAULT 'text',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    edited_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT false,
    reply_to UUID REFERENCES messages(id),
    blockchain_hash TEXT,
    media_url TEXT,
    media_type TEXT,
    media_hash TEXT
);

-- Indexes
CREATE INDEX idx_messages_room_id ON messages(room_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_is_deleted ON messages(is_deleted);
CREATE INDEX idx_messages_reply_to ON messages(reply_to);
CREATE INDEX idx_messages_blockchain_hash ON messages(blockchain_hash);
```

### `message_reactions`
Stores emoji reactions to messages.

```sql
CREATE TABLE message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji)
);

-- Indexes
CREATE INDEX idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX idx_message_reactions_user_id ON message_reactions(user_id);
```

### `message_reads`
Stores read receipts for messages.

```sql
CREATE TABLE message_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

-- Indexes
CREATE INDEX idx_message_reads_message_id ON message_reads(message_id);
CREATE INDEX idx_message_reads_user_id ON message_reads(user_id);
```

### `media`
Stores media file metadata and hashes.

```sql
CREATE TABLE media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_media_user_id ON media(user_id);
CREATE INDEX idx_media_file_hash ON media(file_hash);
CREATE INDEX idx_media_created_at ON media(created_at);
```

### `activity_logs` (Optional)
Stores user activity for analytics and debugging.

```sql
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    metadata JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);
CREATE INDEX idx_activity_logs_timestamp ON activity_logs(timestamp);
```

## Row Level Security (RLS)

### Enable RLS on all tables:
```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
```

### RLS Policies:

#### Users table:
```sql
-- Users can read their own profile
CREATE POLICY "Users can read own profile" ON users
    FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);
```

#### Rooms table:
```sql
-- Users can read rooms they're members of
CREATE POLICY "Users can read rooms they're members of" ON rooms
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM room_members
            WHERE room_members.room_id = rooms.id
            AND room_members.user_id = auth.uid()
            AND room_members.is_active = true
        )
    );

-- Users can create rooms
CREATE POLICY "Users can create rooms" ON rooms
    FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Room admins can update rooms
CREATE POLICY "Room admins can update rooms" ON rooms
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM room_members
            WHERE room_members.room_id = rooms.id
            AND room_members.user_id = auth.uid()
            AND room_members.role = 'admin'
            AND room_members.is_active = true
        )
    );
```

#### Messages table:
```sql
-- Users can read messages from rooms they're members of
CREATE POLICY "Users can read messages from their rooms" ON messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM room_members
            WHERE room_members.room_id = messages.room_id
            AND room_members.user_id = auth.uid()
            AND room_members.is_active = true
        )
    );

-- Users can insert messages to rooms they're members of
CREATE POLICY "Users can send messages to their rooms" ON messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id
        AND EXISTS (
            SELECT 1 FROM room_members
            WHERE room_members.room_id = messages.room_id
            AND room_members.user_id = auth.uid()
            AND room_members.is_active = true
        )
    );

-- Users can update their own messages
CREATE POLICY "Users can update own messages" ON messages
    FOR UPDATE USING (auth.uid() = sender_id);

-- Users can delete their own messages
CREATE POLICY "Users can delete own messages" ON messages
    FOR DELETE USING (auth.uid() = sender_id);
```

## Database Functions

### Update room updated_at trigger:
```sql
CREATE OR REPLACE FUNCTION update_room_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE rooms SET updated_at = NOW() WHERE id = NEW.room_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_room_updated_at
    AFTER INSERT OR UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_room_updated_at();
```

### Clean up old activity logs:
```sql
CREATE OR REPLACE FUNCTION cleanup_old_activity_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM activity_logs
    WHERE timestamp < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (requires pg_cron extension)
SELECT cron.schedule('cleanup-logs', '0 2 * * *', 'SELECT cleanup_old_activity_logs();');
```

## Storage Buckets

### Create media storage bucket:
```sql
-- Create storage bucket for media files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'media',
    'media',
    true,
    10485760, -- 10MB
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'application/pdf']
);
```

### Storage RLS policies:
```sql
-- Users can upload media
CREATE POLICY "Users can upload media" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'media'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Users can read media
CREATE POLICY "Users can read media" ON storage.objects
    FOR SELECT USING (bucket_id = 'media');

-- Users can delete their own media
CREATE POLICY "Users can delete own media" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'media'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );
```

## Performance Considerations

1. **Indexing**: All frequently queried columns have indexes
2. **Partitioning**: Consider partitioning messages table by room_id for large scale
3. **Archiving**: Implement message archiving for old conversations
4. **Vacuum**: Regular vacuum operations for optimal performance

## Backup and Recovery

1. **Point-in-time Recovery**: Enabled by default with Supabase
2. **Daily Backups**: Automated daily backups
3. **Cross-region Replication**: For high availability

## Migration Scripts

All migration scripts are located in `/docs/database/migrations/` directory with proper versioning.
