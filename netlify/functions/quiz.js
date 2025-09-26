// netlify/functions/quiz.js
export async function handler(event, context) {
  try {
    const { topic, numQuestions, difficulty, language } = JSON.parse(event.body);

    const prompt = `
      Generate a ${numQuestions}-question multiple-choice quiz about "${topic}".
      Difficulty: "${difficulty}".
      Language: "${language}".
      Your ENTIRE response must be a valid JSON array ONLY.
    `;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.1-70b-instruct",
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await res.json();
    let llmResponse = data.choices[0].message.content;

    // Extract only JSON array
    const firstBracket = llmResponse.indexOf("[");
    const lastBracket = llmResponse.lastIndexOf("]");
    if (firstBracket === -1 || lastBracket === -1) {
      throw new Error("AI response does not contain valid JSON array");
    }

    const jsonString = llmResponse.slice(firstBracket, lastBracket + 1);
    const questions = JSON.parse(jsonString);

    return {
      statusCode: 200,
      body: JSON.stringify({ questions }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
