-- ==========================================
-- SPARK APP — SUPABASE DATABASE SCHEMA SETUP
-- Chạy đoạn lệnh SQL này tại: Supabase Dashboard > SQL Editor
-- ==========================================

-- 1. Bảng lưu trữ Ý tưởng (ideas)
CREATE TABLE IF NOT EXISTS ideas (
  id TEXT PRIMARY KEY,
  content TEXT,
  author TEXT,
  stage TEXT DEFAULT 'spark',
  color TEXT,
  pinned BOOLEAN DEFAULT false,
  "prototypeHtml" TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  images JSONB DEFAULT '[]'::jsonb,
  timeline JSONB DEFAULT '[]'::jsonb,
  "createdAt" BIGINT,
  "updatedAt" BIGINT
);

-- 2. Bảng lưu trữ Dự án (projects)
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT,
  "desc" TEXT,
  status TEXT DEFAULT 'concept',
  cover TEXT,
  link TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  gallery JSONB DEFAULT '[]'::jsonb,
  checklist JSONB DEFAULT '[]'::jsonb,
  "createdAt" BIGINT,
  "updatedAt" BIGINT
);

-- 3. Bảng Cộng đồng (board)
CREATE TABLE IF NOT EXISTS board (
  id TEXT PRIMARY KEY,
  title TEXT,
  "desc" TEXT,
  author TEXT,
  votes JSONB DEFAULT '[]'::jsonb,
  claims JSONB DEFAULT '[]'::jsonb,
  "createdAt" BIGINT
);

-- 4. Bật Row Level Security (RLS) & Cấp quyền đọc/ghi công khai
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE board ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access ideas" ON ideas;
CREATE POLICY "Public access ideas" ON ideas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access projects" ON projects;
CREATE POLICY "Public access projects" ON projects FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access board" ON board;
CREATE POLICY "Public access board" ON board FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 5. Chia sẻ dự án theo nickname (shares)
-- ==========================================
CREATE TABLE IF NOT EXISTS shares (
  id TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  owner TEXT NOT NULL,
  "sharedWith" TEXT NOT NULL,
  "createdAt" BIGINT
);

ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access shares" ON shares;
CREATE POLICY "Public access shares" ON shares FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 6. Bình luận dự án (chat live giữa các user đã share)
-- ==========================================
CREATE TABLE IF NOT EXISTS project_comments (
  id TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  "createdAt" BIGINT
);

ALTER TABLE project_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access project_comments" ON project_comments;
CREATE POLICY "Public access project_comments" ON project_comments FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 7. Bật Realtime cho bảng bình luận (chat live)
-- Nếu báo lỗi "publication does not exist", chạy:
--   CREATE PUBLICATION supabase_realtime;
-- ==========================================
ALTER PUBLICATION supabase_realtime ADD TABLE project_comments;
