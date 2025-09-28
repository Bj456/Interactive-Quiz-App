// Global Variables
let currentQuestionIndex = 0;
let score = 0;
let timerInterval;
let timeLeft;
let questions = [];
let quizSettings = {};
let hintUsed = false;

// DOM Elements
const startScreen = document.getElementById('start-screen');
const quizScreen = document.getElementById('quiz-screen');
const scoreScreen = document.getElementById('score-screen');
const loadingOverlay = document.getElementById('loading-overlay');
const errorMessage = document.getElementById('error-message');
const questionElement = document.getElementById('question');
const answerButtons = document.getElementById('answer-buttons');
const hintBtn = document.getElementById('hint-btn');
const nextBtn = document.getElementById('next-btn');
const questionCounter = document.getElementById('question-counter');
const scoreCounter = document.getElementById('score-counter');
const timerElement = document.getElementById('timer');
const progressBar = document.getElementById('progress-bar');
const finalScore = document.getElementById('final-score');
const scoreFeedback = document.getElementById('score-feedback');
const playAgainBtn = document.getElementById('play-again-btn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('quiz-settings-form');
    form.addEventListener('submit', startQuiz);
    playAgainBtn.addEventListener('click', resetQuiz);
});

// Start Quiz
async function startQuiz(e) {
    e.preventDefault();
    showLoading(true);
    
    try {
        // Get settings from form
        quizSettings = {
            topic: document.getElementById('topic').value,
            numQuestions: parseInt(document.getElementById('num-questions').value),
            difficulty: document.getElementById('difficulty').value,
            language: document.getElementById('language').value,
            timerDuration: parseInt(document.getElementById('timer-duration').value),
            hintsEnabled: document.querySelector('input[name="hint-option"]:checked').value === 'enable'
        };
        
        await generateQuestionsWithAI();
        window.questions = questions;  // For PDF access (original)
        window.quizSettings = quizSettings;  // <-- Added this line for Hindi PDF (language/topic global access)
        
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
        showLoading(false);
    }
}

// Generate Questions with AI (Netlify Function)
async function generateQuestionsWithAI() {
    const prompt = `Generate ${quizSettings.numQuestions} multiple-choice quiz questions on the topic "${quizSettings.topic}" at ${quizSettings.difficulty} difficulty level in ${quizSettings.language} language. Each question should have 4 options (a, b, c, d) with one correct answer. Format as JSON array of objects: [{"question": "Question text?", "answers": ["option a", "option b", "option c", "option d"], "correctIndex": 0}, ...]. Do not include explanations or extra text.`;
    
    try {
        const response = await fetch('/.netlify/functions/generate-quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });
        
        if (!response.ok) throw new Error(`AI service error: ${response.status}`);
        
        const data = await response.json();
        questions = JSON.parse(data.questions);
        
        // Ensure correctIndex is within bounds
        questions.forEach(q => {
            if (q.correctIndex >= q.answers.length) q.correctIndex = 0;
        });
    } catch (error) {
        console.error('AI Generation Error:', error);
        throw new Error('Failed to generate questions. Please check your topic and try again.');
    }
}

// Show Screen
function showScreen(screen) {
    [startScreen, quizScreen, scoreScreen].forEach(s => s.classList.add('hidden'));
    screen.classList.remove('hidden');
}

// Show Loading
function showLoading(show) {
    loadingOverlay.classList.toggle('hidden', !show);
}

// Show Error
function showError(message) {
    const errorP = errorMessage.querySelector('p');
    errorP.textContent = message;
    errorMessage.classList.remove('hidden');
}

// Show Question
function showQuestion() {
    if (currentQuestionIndex >= questions.length) {
        endQuiz();
        return;
    }
    
    const q = questions[currentQuestionIndex];
    questionElement.textContent = q.question;
    answerButtons.innerHTML = '';
    hintUsed = false;
    
    // Update UI
    questionCounter.textContent = `Question ${currentQuestionIndex + 1} of ${questions.length}`;
    updateProgress();
    
    // Timer
    if (quizSettings.timerDuration > 0) {
        timeLeft = quizSettings.timerDuration;
        timerElement.textContent = `Time: ${timeLeft}`;
        startTimer();
    } else {
        timerElement.textContent = 'Time: No Timer';
        clearInterval(timerInterval);
    }
    
    // Hint Button
    if (quizSettings.hintsEnabled) {
        hintBtn.classList.remove('hidden');
        hintBtn.onclick = () => showHint(q);
    } else {
        hintBtn.classList.add('hidden');
    }
    
    // Answer Buttons
    q.answers.forEach((answer, index) => {
        const btn = document.createElement('button');
        btn.className = 'answer-btn';
        btn.textContent = `${String.fromCharCode(97 + index)}) ${answer}`;
        btn.onclick = () => selectAnswer(index, q.correctIndex);
        answerButtons.appendChild(btn);
    });
    
    nextBtn.classList.add('hidden');
}

// Select Answer
function selectAnswer(selectedIndex, correctIndex) {
    clearInterval(timerInterval);
    
    const buttons = answerButtons.querySelectorAll('.answer-btn');
    buttons.forEach((btn, index) => {
        btn.disabled = true;
        if (index === correctIndex) {
            btn.classList.add('correct');
        } else if (index === selectedIndex && index !== correctIndex) {
            btn.classList.add('wrong');
        }
    });
    
    if (selectedIndex === correctIndex) {
        score++;
        scoreCounter.textContent = `Score: ${score}`;
    }
    
    nextBtn.classList.remove('hidden');
    nextBtn.onclick = nextQuestion;
}

// Next Question
function nextQuestion() {
    currentQuestionIndex++;
    showQuestion();
}

// Show Hint
function showHint(q) {
    if (hintUsed) return;
    hintUsed = true;
    
    const hintText = `Hint: The answer is option ${String.fromCharCode(97 + q.correctIndex)}.`;
    alert(hintText);  // Simple alert, can be improved with modal
}

// Start Timer
function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        timerElement.textContent = `Time: ${timeLeft}`;
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            selectAnswer(-1, questions[currentQuestionIndex].correctIndex);  // Auto wrong
        }
    }, 1000);
}

// Update Progress
function updateProgress() {
    const progress = ((currentQuestionIndex) / questions.length) * 100;
    progressBar.style.width = progress + '%';
}

// End Quiz
function endQuiz() {
    clearInterval(timerInterval);
    const percentage = Math.round((score / questions.length) * 100);
    
    finalScore.textContent = `You scored ${score} out of ${questions.length} (${percentage}%)`;
    
    if (percentage >= 90) {
        scoreFeedback.textContent = 'Outstanding!';
    } else if (percentage >= 70) {
        scoreFeedback.textContent = 'Great job!';
    } else if (percentage >= 50) {
        scoreFeedback.textContent = 'Good effort!';
    } else {
        scoreFeedback.textContent = 'Keep practicing!';
    }
    
    showScreen(scoreScreen);
}

// Reset Quiz
function resetQuiz() {
    currentQuestionIndex = 0;
    score = 0;
    questions = [];
    clearInterval(timerInterval);
    showScreen(startScreen);
    document.getElementById('quiz-settings-form').reset();
    progressBar.style.width = '0%';
}
