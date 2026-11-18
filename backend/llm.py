import os, json, re
from openai import OpenAI
 
# All four providers expose OpenAI-compatible chat endpoints.
PROVIDERS = {
    "groq": ("https://api.groq.com/openai/v1", "GROQ_API_KEY", "GROQ_MODEL"),
    "gemini": ("https://generativelanguage.googleapis.com/v1beta/openai/", "GEMINI_API_KEY", "GEMINI_MODEL"),
    "openai": ("https://api.openai.com/v1", "OPENAI_API_KEY", "OPENAI_MODEL"),
    "grok": ("https://api.x.ai/v1", "GROK_API_KEY", "GROK_MODEL"),
}
 
def available():
    order = [p.strip() for p in os.getenv("LLM_ORDER", "groq,gemini,openai,grok").split(",")]
    return [p for p in order if p in PROVIDERS and os.getenv(PROVIDERS[p][1])]
 
def _parse(text):
    fence = "`" * 3
    text = re.sub("^" + fence + "(?:json)?|" + fence + "$", "", text.strip(), flags=re.M).strip()
    return json.loads(text)
 
def chat_json(system, user, preferred=None):
    """Return (dict, 'provider:model'). Tries providers in order and falls back on any error."""
    order = available()
    if preferred in order:
        order = [preferred] + [p for p in order if p != preferred]
    errors = []
    for name in order:
        base, key_env, model_env = PROVIDERS[name]
        try:
            client = OpenAI(base_url=base, api_key=os.getenv(key_env), timeout=45)
            r = client.chat.completions.create(
                model=os.getenv(model_env),
                messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
                response_format={"type": "json_object"},
                temperature=0.1,
            )
            return _parse(r.choices[0].message.content), f"{name}:{os.getenv(model_env)}"
        except Exception as e:
            errors.append(f"{name}: {e}")
    raise RuntimeError("All LLM providers failed or none configured: " + " | ".join(errors))