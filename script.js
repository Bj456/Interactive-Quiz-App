// ===================================================================================
//
// ✅ SECURE VERSION: API calls go through Netlify Functions
// Your API key stays hidden in Netlify Environment Variables.
// Developed by Teacher Bhaskar Joshi
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

// --- Improved Utility function for safe string comparison (with punctuation strip) ---
function normalize(str) {
    if (!str) return "";
    // Trim, lowercase, and remove common punctuation (., !, ?, A), B) etc.)
    return str.trim().toLowerCase()
        .replace(/[.,!?;:]/g, '')  // Remove punctuation
        .replace(/^[a-z]\$\s*/i, '')  // Remove "A) ", "B) " prefixes
        .replace(/^\d+\.\s*/i, '');  // Remove "1. " prefixes
}

// --- Show Screen Function (Missing Earlier) ---
function showScreen(screen) {
    [startScreen, quizScreen, scoreScreen].forEach(s => s.classList.add('hidden'));
    screen.classList.remove('hidden');
}

// --- Start Quiz ---
async function startQuiz(e) {
    e.preventDefault();
    errorMessage.classList.add('hidden');

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
            // Validate questions after generation
            questions.forEach((q, index) => {
                const normalizedCorrect = normalize(q.correct_answer);
                const matchingOptions = q.answers.filter(opt => normalize(opt) === normalizedCorrect);
                if (matchingOptions.length === 0) {
                    console.warn(`Question ${index + 1}: No matching correct answer found! Correct: "${q.correct_answer}", Options:`, q.answers);
                    // Fallback: Set first option as correct if no match (temporary fix)
                    q.correct_answer = q.answers[0] || '';
                }
            });
            
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

// --- Generate Questions from AI (Netlify Function) ---
async function generateQuestionsWithAI() {
    try {
        const { topic, numQuestions, difficulty, language } = quizSettings;

        const response = await fetch("/.netlify/functions/quiz", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topic, numQuestions, difficulty, language })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || "Failed to generate quiz");
        }

        const data = await response.json();

        questions = data.questions.map(q => ({
            question: q.question || "No question text",
            answers: Array.isArray(q.options) ? q.options : [],
            correct_answer: q.correctAnswer || ""
        }));

    } catch (error) {
        console.error("Error generating quiz with AI:", error);
        questions = [];
        throw error;
    }
}

// --- Show Question ---
function showQuestion() {
    resetState();
    const currentQuestion = questions[currentQuestionIndex];

    questionElement.textContent = currentQuestion.question || "No question available"; 
    questionCounter.textContent = `Question ${currentQuestionIndex + 1} of ${questions.length}`;
    progressBar.style.width = `${((currentQuestionIndex + 1) / questions.length) * 100}%`;

    const shuffledAnswers = [...currentQuestion.answers].sort(() => Math.random() - 0.5);

    let hasCorrect = false;
    shuffledAnswers.forEach(answer => {
        const button = document.createElement('button');
        button.innerHTML = `<span>${answer}</span>`;
        button.classList.add('btn');

        const isMatch = normalize(answer) === normalize(currentQuestion.correct_answer);
        button.dataset.correct = isMatch ? "true" : "false";
        
        if (isMatch) hasCorrect = true;

        button.addEventListener('click', selectAnswer);
        answerButtonsElement.appendChild(button);
    });

    // Debug log
    console.log(`Question ${currentQuestionIndex + 1}:`, {
        question: currentQuestion.question,
        correct: currentQuestion.correct_answer,
        options: currentQuestion.answers,
        hasCorrectMatch: hasCorrect
    });

    if (!hasCorrect) {
        console.error(`No correct option matched for question ${currentQuestionIndex + 1}! Check AI response.`);
        showError("Warning: Question data mismatch. Check console for details.");
    }

    if (quizSettings.hintsEnabled) {
        hintBtn.classList.remove('hidden');
        hintBtn.disabled = false;
    }

    startTimer();
}

// --- Timer ---
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

// --- Handle Time Up ---
function handleTimeUp() {
    Array.from(answerButtonsElement.children).forEach(button => {
        const correct = button.dataset.correct === "true";
        setStatusClass(button, correct);
        button.disabled = true;
    });
    nextBtn.classList.remove('hidden');
    hintBtn.classList.add('hidden');
}

// --- Select Answer (Improved: Highlight selected even if wrong) ---
function selectAnswer(e) {
    clearInterval(timer);
    const selectedButton = e.currentTarget;
    const isCorrect = selectedButton.dataset.correct === "true";

    // Visual feedback for selected button first
    selectedButton.classList.add('selected');  // Add a 'selected' class for highlight (add CSS if needed)

    if (isCorrect) {
        score++;
        scoreCounter.textContent = `Score: ${score}`;
    }

    Array.from(answerButtonsElement.children).forEach(button => {
        const correct = button.dataset.correct === "true";
        setStatusClass(button, correct);
        button.disabled = true;
    });

    if (questions.length > currentQuestionIndex + 1) {
        nextBtn.classList.remove('hidden');
    } else {
        setTimeout(showFinalScore, 1500); 
    }
    
    hintBtn.classList.add('hidden');
}

// --- Next Button ---
function handleNextButton() {
    currentQuestionIndex++;
    showQuestion();
}

// --- Show Final Score ---
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

// --- Hint ---
function showHint() {
    const incorrectButtons = Array.from(answerButtonsElement.children).filter(btn => btn.dataset.correct !== "true");
    if (incorrectButtons.length > 1) {
        const buttonToDisable = incorrectButtons[Math.floor(Math.random() * incorrectButtons.length)];
        buttonToDisable.style.visibility = 'hidden';
        hintBtn.disabled = true;
    }
}

// --- Reset & Restart ---
function resetAndRestart() {
    showScreen(startScreen);
}

// --- Show Error ---
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
    // Ensure selected button gets extra style if needed (CSS में .selected { border: 2px solid blue; } ऐड करें)
}
