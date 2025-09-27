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

// --- Improved Utility function for safe string comparison (enhanced cleaning) ---
function normalize(str) {
    if (!str) return "";
    return str.trim().toLowerCase()
        .replace(/[.,!?;:()]/g, '')  // Remove punctuation including ()
        .replace(/^[a-z0-9]\$\s*/i, '')  // Remove "A) ", "1. " prefixes
        .replace(/^\d+\.\s*/i, '')  // Remove numbered prefixes
        .replace(/\b(the|a|an)\b\s*/gi, '');  // Optional: Remove common articles if needed
}

// --- Show Screen Function ---
function showScreen(screen) {
    [startScreen, quizScreen, scoreScreen].forEach(s => s.classList.add('hidden'));
    screen.classList.remove('hidden');
}

// --- Start Quiz (Improved Validation - No Fallback, Filter Invalid Questions) ---
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
        
        // Validate and filter valid questions only
        const validQuestions = [];
        let invalidCount = 0;
        questions.forEach((q, index) => {
            const normalizedCorrect = normalize(q.correct_answer);
            const matchingOptions = q.answers.filter(opt => normalize(opt) === normalizedCorrect);
            if (matchingOptions.length > 0 && q.answers.length >= 2) {  // At least 2 options and match found
                validQuestions.push(q);
            } else {
                console.warn(`Question ${index + 1} skipped (invalid): Correct: "${q.correct_answer}", Normalized: "${normalizedCorrect}", Options:`, q.answers.map(opt => `"${normalize(opt)}"`));
                invalidCount++;
            }
        });

        questions = validQuestions;

        if (questions.length === 0) {
            throw new Error(`No valid questions generated. AI response had mismatches (invalid: ${invalidCount}). Try different topic/settings or check backend prompt.`);
        } else if (invalidCount > 0) {
            console.warn(`${invalidCount} questions skipped due to data mismatch.`);
            showError(`Warning: ${invalidCount} questions skipped due to AI data issues. Only ${questions.length} valid questions loaded.`);
        }

        currentQuestionIndex = 0;
        score = 0;
        scoreCounter.textContent = `Score: 0`;
        showScreen(quizScreen);
        showQuestion();
    } catch (error) {
        showError(error.message);
        // Optional: Retry generation if no questions
        if (error.message.includes("No valid questions")) {
            setTimeout(() => {
                if (confirm("No valid quiz generated. Retry with same settings?")) {
                    startQuiz(e);
                }
            }, 1000);
        }
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
            correct_answer: q.correctAnswer || q.correct_answer || ""  // Try both field names
        }));
        // Make questions globally accessible for PDF generation
window.questions = questions;


    } catch (error) {
        console.error("Error generating quiz with AI:", error);
        questions = [];
        throw error;
    }
}

// --- Show Question (Extra Safety Check) ---
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

    // Debug log (remove in production)
    console.log(`Question ${currentQuestionIndex + 1}:`, {
        question: currentQuestion.question,
        correct: currentQuestion.correct_answer,
        normalizedCorrect: normalize(currentQuestion.correct_answer),
        options: currentQuestion.answers.map(opt => ({ raw: opt, normalized: normalize(opt) })),
        hasCorrectMatch: hasCorrect
    });

    if (!hasCorrect) {
        console.error(`CRITICAL: No correct option matched for question ${currentQuestionIndex + 1}! Skipping to next.`);
        alert(`Question ${currentQuestionIndex + 1} has data error. Skipping...`);  // Temporary alert
        handleNextButton();  // Skip to next
        return;
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

// --- Select Answer ---
function selectAnswer(e) {
    clearInterval(timer);
    const selectedButton = e.currentTarget;
    const isCorrect = selectedButton.dataset.correct === "true";

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
    if (currentQuestionIndex < questions.length) {
        showQuestion();
    } else {
        showFinalScore();
    }
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
}
