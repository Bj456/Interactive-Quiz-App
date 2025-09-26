// ===================================================================================
//
// ✅ SECURE VERSION: API calls go through Netlify Functions
// Your API key stays hidden in Netlify Environment Variables.
// You must create: /netlify/functions/quiz.js (as backend function)
//
// ===================================================================================

// DOM Elements
const loadingOverlay = document.getElementById('loading-overlay');
const errorMessage = document.getElementById('error-message');
const startScreen = document.getElementById('start-screen');
const quizScreen = document.getElementById('quiz-screen');
const scoreScreen = document.getElementById('score-screen');

const settingsForm = document.getElementById('quiz-settings-form');
const topicInput = document.getElementById('topic');
const numQuestionsInput = document.getElementById('num-questions');
const difficultySelect = document.getElementById('difficulty');
const languageSelect = document.getElementById('language');
const timerDurationInput = document.getElementById('timer-duration');
const startBtn = document.getElementById('start-btn');

const progressBar = document.getElementById('progress-bar');
const questionCounter = document.getElementById('question-counter');
const scoreCounter = document.getElementById('score-counter');
const timerDisplay = document.getElementById('timer');
const questionElement = document.getElementById('question');
const answerButtonsElement = document.getElementById('answer-buttons');
const hintBtn = document.getElementById('hint-btn');
const nextBtn = document.getElementById('next-btn');

const finalScoreElement = document.getElementById('final-score');
const scoreFeedbackElement = document.getElementById('score-feedback');
const playAgainBtn = document.getElementById('play-again-btn');

// State Variables
let questions = [];
let currentQuestionIndex = 0;
let score = 0;
let timer;
let timeLeft;
let quizSettings = {};

// --- Event Listeners ---
settingsForm.addEventListener('submit', startQuiz);
nextBtn.addEventListener('click', handleNextButton);
playAgainBtn.addEventListener('click', resetAndRestart);
hintBtn.addEventListener('click', showHint);

function showScreen(screen) {
    [startScreen, quizScreen, scoreScreen].forEach(s => s.classList.add('hidden'));
    screen.classList.remove('hidden');
}

async function startQuiz(e) {
    e.preventDefault();
    errorMessage.classList.add('hidden'); // Hide any previous errors
    
    quizSettings = {
        topic: topicInput.value,
        numQuestions: numQuestionsInput.value,
        difficulty: difficultySelect.value,
        language: languageSelect.value,
        timerDuration: parseInt(timerDurationInput.value, 10),
        hintsEnabled: document.querySelector('input[name="hint-option"]:checked').value === 'enable'
    };
    
    loadingOverlay.classList.remove('hidden');
    startBtn.disabled = true;

    try {
        await generateQuestionsWithAI();
        if (questions && questions.length > 0) {
            currentQuestionIndex = 0;
            score = 0;
            scoreCounter.textContent = `Score: 0`;
            showScreen(quizScreen);
            showQuestion();
        } else {
            throw new Error("The AI did not return any questions. Please try a different topic or settings.");
        }
    } catch (error) {
        showError(error.message);
    } finally {
        loadingOverlay.classList.add('hidden');
        startBtn.disabled = false;
    }
}

async function generateQuestionsWithAI() {
    const { topic, numQuestions, difficulty, language } = quizSettings;

    const prompt = `
        Generate a ${numQuestions}-question multiple-choice quiz about "${topic}".
        Difficulty: "${difficulty}".
        Language: "${language}".

        Your ENTIRE response must ONLY be valid JSON (array of objects).
        ❌ Do NOT include text, explanations, or markdown.
        ✅ Just return raw JSON array like:
        [
          {
            "question": "...",
            "options": ["...", "...", "...", "..."],
            "correctAnswer": "..."
          }
        ]
    `;

    try {
        const response = await fetch("/.netlify/functions/quiz", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            const errorMsg = errorData?.error || `API Error: ${response.status}`;
            throw new Error(errorMsg);
        }

        const data = await response.json();
        let llmResponse = data.choices[0].message.content.trim();

        // 🛡 Fix: Extract only JSON part if model adds extra text
        const firstBracket = llmResponse.indexOf("[");
        const lastBracket = llmResponse.lastIndexOf("]");
        if (firstBracket !== -1 && lastBracket !== -1) {
            llmResponse = llmResponse.slice(firstBracket, lastBracket + 1);
        }

        // Parse JSON safely
        const parsedQuestions = JSON.parse(llmResponse);
        questions = parsedQuestions.map(q => ({
            question: q.question,
            answers: q.options,
            correct_answer: q.correctAnswer
        }));

    } catch (error) {
        console.error("Error generating quiz with AI:", error);
        questions = [];
        throw error;
    }
}


function showQuestion() {
    resetState();
    const currentQuestion = questions[currentQuestionIndex];
    
    questionElement.textContent = currentQuestion.question; 
    questionCounter.textContent = `Question ${currentQuestionIndex + 1} of ${questions.length}`;
    progressBar.style.width = `${((currentQuestionIndex + 1) / questions.length) * 100}%`;

    const shuffledAnswers = [...currentQuestion.answers].sort(() => Math.random() - 0.5);

    shuffledAnswers.forEach(answer => {
        const button = document.createElement('button');
        button.innerHTML = `<span>${answer}</span>`;
        button.classList.add('btn');
        if (answer === currentQuestion.correct_answer) {
            button.dataset.correct = true;
        }
        button.addEventListener('click', selectAnswer);
        answerButtonsElement.appendChild(button);
    });

    if (quizSettings.hintsEnabled) {
        hintBtn.classList.remove('hidden');
        hintBtn.disabled = false;
    }

    startTimer();
}

function startTimer() {
    timeLeft = quizSettings.timerDuration;
    timerDisplay.textContent = `Time: ${timeLeft}`;
    clearInterval(timer); 
    timer = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = `Time: ${timeLeft}`;
        if (timeLeft <= 0) {
            clearInterval(timer);
            handleTimeUp();
        }
    }, 1000);
}

function handleTimeUp() {
    Array.from(answerButtonsElement.children).forEach(button => {
        setStatusClass(button, button.dataset.correct);
        button.disabled = true;
    });
    nextBtn.classList.remove('hidden');
    hintBtn.classList.add('hidden');
}

function selectAnswer(e) {
    clearInterval(timer);
    const selectedButton = e.currentTarget;
    const isCorrect = selectedButton.dataset.correct === 'true';

    if (isCorrect) {
        score++;
        scoreCounter.textContent = `Score: ${score}`;
    }

    Array.from(answerButtonsElement.children).forEach(button => {
        setStatusClass(button, button.dataset.correct);
        button.disabled = true;
    });

    if (questions.length > currentQuestionIndex + 1) {
        nextBtn.classList.remove('hidden');
    } else {
        setTimeout(showFinalScore, 1500); 
    }
    
    hintBtn.classList.add('hidden');
}

function handleNextButton() {
    currentQuestionIndex++;
    showQuestion();
}

function showFinalScore() {
    showScreen(scoreScreen);
    const scorePercent = Math.round((score / questions.length) * 100);
    finalScoreElement.textContent = `You scored ${score} out of ${questions.length} (${scorePercent}%)`;

    let feedback = '';
    if (scorePercent === 100) feedback = "Flawless Victory! You're an absolute genius! 🏆";
    else if (scorePercent >= 75) feedback = "Excellent! You have a deep knowledge of this topic. 🎉";
    else if (scorePercent >= 50) feedback = "Good job! A very respectable score. 👍";
    else feedback = "Nice try! Every quiz is a learning opportunity. 💪";
    scoreFeedbackElement.textContent = feedback;
}

function showHint() {
    const incorrectButtons = Array.from(answerButtonsElement.children).filter(btn => !btn.dataset.correct);
    if (incorrectButtons.length > 1) {
        const buttonToDisable = incorrectButtons[Math.floor(Math.random() * incorrectButtons.length)];
        buttonToDisable.style.visibility = 'hidden';
        hintBtn.disabled = true;
    }
}

function resetAndRestart() {
    showScreen(startScreen);
}

function showError(message) {
    errorMessage.textContent = `⚠️ Error: ${message}`;
    errorMessage.classList.remove('hidden');
}

// --- Utility Functions ---
function resetState() {
    nextBtn.classList.add('hidden');
    hintBtn.classList.add('hidden');
    answerButtonsElement.innerHTML = '';
}

function setStatusClass(button, isCorrect) {
    if (isCorrect) {
        button.classList.add('correct');
        button.innerHTML += ' <span>✓</span>';
    } else {
        button.classList.add('incorrect');
        button.innerHTML += ' <span>✗</span>';
    }
}
