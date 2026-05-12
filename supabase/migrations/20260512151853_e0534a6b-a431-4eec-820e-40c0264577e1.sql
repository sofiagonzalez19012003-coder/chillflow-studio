
-- Enums
CREATE TYPE public.linea_brand AS ENUM ('tapes', 'zen', 'play', 'all');
CREATE TYPE public.content_type AS ENUM ('reel_script','carousel','post_caption','email','tiktok_hook','ad_copy');
CREATE TYPE public.platform_type AS ENUM ('instagram','tiktok','youtube','threads','email','spotify_description');
CREATE TYPE public.funnel_stage AS ENUM ('tofu','mofu','bofu');
CREATE TYPE public.content_status AS ENUM ('draft','approved','scheduled','published');
CREATE TYPE public.campaign_type AS ENUM ('email_sequence','social_campaign','weekly_batch');
CREATE TYPE public.campaign_status AS ENUM ('draft','active','completed');

-- Profiles (workspace settings)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  company_name TEXT NOT NULL DEFAULT 'Chill Vibe by Kapital Music',
  brand_voice TEXT NOT NULL DEFAULT 'Intimate, nocturnal, poetic. We sell the moment, not the music.',
  target_audiences TEXT[] NOT NULL DEFAULT ARRAY['deep_workers','students','gamers','mindfulness_enthusiasts'],
  active_lines TEXT[] NOT NULL DEFAULT ARRAY['tapes','zen','play'],
  instagram_handle TEXT NOT NULL DEFAULT '@chillvibeglobal',
  onboarded BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  linea linea_brand NOT NULL DEFAULT 'all',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  type content_type NOT NULL,
  platform platform_type NOT NULL,
  linea linea_brand NOT NULL,
  funnel_stage funnel_stage NOT NULL DEFAULT 'tofu',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_prompt TEXT,
  status content_status NOT NULL DEFAULT 'draft',
  scheduled_for TIMESTAMPTZ,
  engagement_score INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  website_url TEXT NOT NULL,
  scraped_content TEXT,
  scraped_at TIMESTAMPTZ,
  ai_analysis JSONB,
  analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type campaign_type NOT NULL,
  linea linea_brand NOT NULL DEFAULT 'all',
  status campaign_status NOT NULL DEFAULT 'draft',
  content_item_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Policies: each user owns their rows
CREATE POLICY "own profile select" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "own projects all" ON public.projects FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own content all" ON public.content_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own competitors all" ON public.competitors FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own campaigns all" ON public.campaigns FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
