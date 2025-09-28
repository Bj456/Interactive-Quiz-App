// netlify/functions/quiz.js
export async function handler(event, context) {
  try {
    const { topic, numQuestions, difficulty, language } = JSON.parse(event.body);
    const expectedCount = parseInt(numQuestions);

    // Language-specific prompt modification
    let langInstruction = "";
    if (language === "Kumaoni") {
      langInstruction = "Respond STRICTLY in Kumaoni language, using the local Kumaoni style and words. Avoid Hindi or English.";
    }

    const prompt = `
Generate EXACTLY ${expectedCount} MCQ quiz questions on "${topic}". Difficulty: ${difficulty}. Language: ${language}.
${langInstruction}

RULES:
- ONLY valid JSON array. Start with [, end with ]. No extra text.
- Each: {"question": "...", "options": ["opt1", "opt2", "opt3", "opt4"] (plain, no A/B, no .), "correctAnswer": "exact one opt"}
- Shuffle options. Complete ALL questions fully.

Example: [{"question":"Capital of India?","options":["Mumbai","Delhi","Kolkata","Chennai"],"correctAnswer":"Delhi"}]

Output ONLY the JSON array. Ensure it ends with ].
`;

    const models = [
      "meta-llama/llama-3.1-70b-instruct",
      "openai/gpt-4o-mini"
    ];

    let questions = null;
    let retryCount = 0;
    const maxRetries = 2;
    let llmResponse = "";

    while (!questions && retryCount < maxRetries) {
      const model = models[retryCount];
      const maxTokens = retryCount === 0 ? 8192 : 16384;

      llmResponse = await callAI(prompt, model, maxTokens);
      console.log(`Attempt ${retryCount + 1} with ${model}, tokens: ${maxTokens}. Response length: ${llmResponse.length}`);

      questions = await extractAndValidateJSON(llmResponse, expectedCount);

      if (!questions || questions.length === 0) {
        console.warn(`Attempt ${retryCount + 1} failed. Retrying...`);
        retryCount++;
      }
    }

    if (!questions || questions.length === 0) {
      throw new Error(`Failed after ${maxRetries} retries. Last response preview: ${llmResponse.substring(0, 500)}`);
    }

    console.log(`Success: ${questions.length} valid questions generated for "${topic}"`);

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

// Helper: Call AI API
async function callAI(prompt, model, maxTokens) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: maxTokens
    })
  });

  if (!res.ok) {
    throw new Error(`API failed: ${res.status} - ${res.statusText}`);
  }

  const data = await res.json();
  return data.choices[0]?.message?.content || "";
}

// Helper: Robust JSON Extraction & Partial Parsing
async function extractAndValidateJSON(llmResponse, expectedCount) {
  console.log("Full response preview:", llmResponse.substring(0, 500) + (llmResponse.length > 500 ? "..." : ""));

  const startIndex = llmResponse.indexOf('[');
  if (startIndex === -1) {
    throw new Error("No opening [ found. Response preview: " + llmResponse.substring(0, 300));
  }

  let jsonString = llmResponse.substring(startIndex);
  const endIndex = llmResponse.lastIndexOf(']');
  if (endIndex > startIndex) {
    jsonString = llmResponse.substring(startIndex, endIndex + 1);
  } else {
    console.warn("No closing ] found - using partial response from [ to end");
    if (!jsonString.endsWith(']')) jsonString += ']';
  }

  console.log("Extracted JSON preview:", jsonString.substring(0, 300) + (jsonString.length > 300 ? "..." : ""));

  try {
    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed)) throw new Error("Parsed content is not an array");

    const validatedQuestions = [];
    parsed.forEach((q, i) => {
      if (q && q.question && Array.isArray(q.options) && q.options.length === 4 && q.correctAnswer) {
        const trimmedCorrect = q.correctAnswer.trim();
        const cleanedOptions = q.options.map(opt => opt.trim());
        if (cleanedOptions.includes(trimmedCorrect)) {
          validatedQuestions.push({
            question: q.question.trim(),
            options: cleanedOptions,
            correctAnswer: trimmedCorrect
          });
          console.log(`Valid question ${i+1}: "${trimmedCorrect}" matches options`);
        } else {
          console.warn(`Question ${i+1} no match: "${trimmedCorrect}" not in [${cleanedOptions.join(', ')}]`);
        }
      } else {
        console.warn(`Question ${i+1} invalid: Missing fields in`, q);
      }
    });

    if (validatedQuestions.length === 0) {
      throw new Error(`No valid questions parsed. Parsed ${parsed.length} items, but all invalid.`);
    }

    if (validatedQuestions.length < expectedCount) {
      console.warn(`Partial success: ${validatedQuestions.length}/${expectedCount} valid questions (likely truncation).`);
    }

    return validatedQuestions;

  } catch (parseErr) {
    const isTruncated = jsonString.includes('"correctAnswer": "') && !jsonString.includes(', "correctAnswer"') || 
                        jsonString.endsWith('"') || jsonString.endsWith(' ');
    throw new Error(`JSON parse failed: ${parseErr.message}. Likely ${isTruncated ? 'truncated' : 'malformed'}. JSON: ${jsonString.substring(0, 400)}`);
  }
}
