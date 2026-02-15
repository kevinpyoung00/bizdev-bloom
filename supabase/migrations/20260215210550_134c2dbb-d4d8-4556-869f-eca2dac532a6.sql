
-- Config store for signal scanner keywords
-- Each row is one keyword category with a JSON array of terms
CREATE TABLE public.signal_keywords (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category text NOT NULL UNIQUE,
  keywords jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.signal_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon read access" ON public.signal_keywords FOR SELECT USING (true);
CREATE POLICY "Authenticated full access" ON public.signal_keywords FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_signal_keywords_updated_at
  BEFORE UPDATE ON public.signal_keywords
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
