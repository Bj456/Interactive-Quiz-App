// netlify/functions/quiz.js
export async function handler(event, context) {
  try {
    const { topic, numQuestions, difficulty, language } = JSON.parse(event.body);

    const prompt = `
Generate EXACTLY ${numQuestions} multiple-choice quiz questions on "${topic}".
Difficulty: ${difficulty}. Language: ${language}.

STRICT RULES:
- JSON array ONLY. No extra text.
- Each object: "question" (string), "options" (array of 4 plain strings, no prefixes/punctuation), "correctAnswer" (exactly one option string).
- Shuffle options. 1 correct + 3 distractors.
- Example: [{"question":"What is the third planet?","options":["Mars","Venus","Earth","Jupiter"],"correctAnswer":"Earth"}]

Output ONLY the JSON array.
`;

    // Function to call AI with given tokens
    const callAI = async (tokens) => {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3.1-70b-instruct",  // Or "openai/gpt-4o-mini" for better handling
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
          max_tokens: tokens  // Dynamic: Start with 4096, retry with 8192
        })
      });

      if (!res.ok) {
        throw new Error(`API request failed: ${res.status} - ${res.statusText}`);
      }

      const data = await res.json();
      return data.choices[0]?.message?.content || "";
    };

    // First attempt
    let llmResponse = await callAI(4096);
    let questions = await extractAndValidateJSON(llmResponse, numQuestions);

    // Retry if invalid (e.g., truncated)
    if (!questions || questions.length < parseInt(numQuestions)) {
      console.warn("First AI call incomplete. Retrying with higher tokens...");
      llmResponse = await callAI(8192);  // Higher limit for retry
      questions = await extractAndValidateJSON(llmResponse, numQuestions);
    }

    if (!questions || questions.length === 0) {
      throw new Error("Failed to generate valid questions after retry. Response preview: " + llmResponse.substring(0, 300));
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

// Helper: Extract and validate JSON from LLM response
async function extractAndValidateJSON(llmResponse, expectedCount) {
  // Improved regex: Match complete outermost array (greedy for full content)
  const jsonMatch = llmResponse.match(/\$[\s\S]*\$/);  // Greedy to capture full array if possible
  if (!jsonMatch) {
    throw new Error("No JSON array found in response. Full preview: " + llmResponse.substring(0, 300));
  }

  const jsonString = jsonMatch[0];
  console.log("Extracted JSON length:", jsonString.length);  // Debug: Check if truncated

  try {
    const questions = JSON.parse(jsonString);
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error(`Parsed empty or invalid array. Length: ${questions?.length || 0}`);
    }

    // Validate each question
    let validCount = 0;
    const validatedQuestions = [];
    questions.forEach((q, i) => {
      if (q.question && Array.isArray(q.options) && q.options.length === 4 && q.correctAnswer) {
        // Check exact match (trimmed)
        const trimmedCorrect = q.correctAnswer.trim();
        const hasMatch = q.options.some(opt => opt.trim() === trimmedCorrect);
        if (hasMatch) {
          validatedQuestions.push({
            question: q.question.trim(),
            options: q.options.map(opt => opt.trim()),  // Clean options
            correctAnswer: trimmedCorrect
          });
          validCount++;
        } else {
          console.warn(`Question ${i+1} skipped: correctAnswer "${q.correctAnswer}" no exact match in options`, q.options);
        }
      } else {
        console.warn(`Question ${i+1} invalid structure:`, q);
      }
    });

    if (validatedQuestions.length < expectedCount) {
      console.warn(`Only ${validatedQuestions.length} valid questions out of ${questions.length} parsed.`);
    }

    // If partial but some valid, return them (better than nothing)
    return validatedQuestions.length > 0 ? validatedQuestions : null;

  } catch (parseErr) {
    // Check if likely truncated (e.g., no closing ] or mid-object)
    const isTruncated = jsonString.includes("What is the p") || !jsonString.endsWith(']') || jsonString.match(/,\s*\{/g)?.length !== jsonString.match(/\{\s*"/g)?.length;
    if (isTruncated) {
      throw new Error(`JSON parse failed - likely truncated response (tokens exceeded). Error: ${parseErr.message}. Preview: ${jsonString.substring(0, 200)}...`);
    } else {
      throw new Error(`JSON parse failed: ${parseErr.message}. Raw JSON: ${jsonString.substring(0, 300)}`);
    }
  }
}
