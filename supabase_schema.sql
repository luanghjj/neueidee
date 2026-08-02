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
