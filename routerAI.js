// OPENROUTER API
export const OPENROUTER_API_KEY = "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";
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

const SYSTEM_PROMPT = `You are PIXEL, a trivia host for pop culture.
Generate exactly 3 levels (Beginner, Intermediate, Master).
Each level must contain 3 multiple-choice questions.
Respond as JSON with shape:
{
  "levels": [
    {"id": "beginner", "questions": [
      {"question": "...", "options": ["A", "B", "C", "D"], "answer": "A"}
    ]}
  ]
}
Facts must only use the given title data.`;

function buildUserPrompt(metadata) {
  return `Title: ${metadata.title}
Media Type: ${metadata.mediaType}
Year: ${metadata.year}
Genres: ${metadata.genre}
Overview: ${metadata.overview}
Use the details to craft lore-accurate questions.`;
}

export async function fetchQuizQuestions(metadata) {
  const body = {
    model: "deepseek/deepseek-chat",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(metadata) },
    ],
    temperature: 0.6,
  };

  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter request failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter returned empty content");
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse quiz JSON");
  }

  return JSON.parse(jsonMatch[0]);
}
