// netlify/functions/quiz.js
export async function handler(event, context) {
  try {
    const { topic, numQuestions, difficulty, language } = JSON.parse(event.body);

    const prompt = `
Generate EXACTLY ${numQuestions} multiple-choice quiz questions on the topic "${topic}".
Difficulty level: ${difficulty} (easy: basic facts; medium: some reasoning; hard: advanced concepts).
Language: ${language} (use full sentences if needed, but keep options concise).

CRITICAL RULES (Follow STRICTLY to ensure data consistency):
- Output ONLY a valid JSON array of objects. NO extra text, explanations, or markdown outside the JSON.
- Each question object MUST have EXACTLY these fields:
  - "question": A single string with the clear question (no options or answers in it).
  - "options": An array of EXACTLY 4 strings (1 correct + 3 plausible distractors). 
    - Options must be PLAIN TEXT: No prefixes like "A)", "B)", "1.", numbers, letters, or bullets.
    - No extra punctuation at the end (e.g., no "Earth." or "Earth!"). Just clean words/phrases.
    - Shuffle the order randomly (don't put correct first).
  - "correctAnswer": A SINGLE STRING that is EXACTLY EQUAL to ONE of the "options" strings.
    - It MUST match perfectly: Same text, no extra spaces, no rephrasing (e.g., if option is "Earth", correctAnswer must be "Earth", not "The Earth" or "Earth planet").
- Ensure all questions are unique, factual, and appropriate for the difficulty.
- Example structure for ONE question (repeat for ${numQuestions}):
[
  {
    "question": "What is the third planet from the Sun in our solar system?",
    "options": ["Mars", "Venus", "Earth", "Jupiter"],
    "correctAnswer": "Earth"
  }
]

Output ONLY the JSON array like the example above. Do not number questions or add any other content.
`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.1-70b-instruct",  // Or try "openai/gpt-4o-mini" for better consistency
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,  // Low for consistency (less creativity)
        max_tokens: 2000   // Enough for multiple questions
      })
    });

    if (!res.ok) {
      throw new Error(`API request failed: ${res.status} - ${res.statusText}`);
    }

    const data = await res.json();
    let llmResponse = data.choices[0]?.message?.content || "";

    // Improved JSON Extraction: Use regex to find the first valid JSON array
    const jsonMatch = llmResponse.match(/\$[\s\S]*?\$/);  // Match outermost [ ... ]
    if (!jsonMatch) {
      throw new Error("AI response does not contain a valid JSON array. Response: " + llmResponse.substring(0, 200));
    }

    const jsonString = jsonMatch[0];
    let questions;
    try {
      questions = JSON.parse(jsonString);
      // Validate: Ensure array and each has required fields
      if (!Array.isArray(questions) || questions.length !== parseInt(numQuestions)) {
        throw new Error(`Expected ${numQuestions} questions, got ${questions.length}`);
      }
      questions.forEach((q, i) => {
        if (!q.question || !Array.isArray(q.options) || q.options.length !== 4 || !q.correctAnswer) {
          throw new Error(`Question ${i+1} missing required fields: question, options (4 items), or correctAnswer`);
        }
        // Quick match check (log only)
        const correctMatch = q.options.some(opt => opt.trim() === q.correctAnswer.trim());
        if (!correctMatch) {
          console.warn(`Warning: Question ${i+1} correctAnswer "${q.correctAnswer}" does not exactly match any option:`, q.options);
        }
      });
    } catch (parseErr) {
      throw new Error(`Invalid JSON in AI response: ${parseErr.message}. Raw: ${jsonString.substring(0, 200)}`);
    }

    console.log(`Successfully generated ${questions.length} questions for topic: ${topic}`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions }),
    };
  } catch (err) {
    console.error("Quiz generation error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message }),
    };
  }
}
