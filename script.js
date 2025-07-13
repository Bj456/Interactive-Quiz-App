// ===================================================================================
//
// 🚨 DANGER: EXPOSING YOUR API KEY IN CLIENT-SIDE CODE IS A SEVERE SECURITY RISK! 🚨
//
// Anyone can view this code and steal your key. For a real application, this API
// call MUST be made from a backend server where the key can be kept secret.
// This implementation is for educational purposes only, as per the request.
//
// ===================================================================================

const OPENROUTER_API_KEY = "YOUR API KEY HERE";
const API_URL = "https://openrouter.ai/api/v1/chat/completions";

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
        The difficulty level must be "${difficulty}".
        The quiz must be entirely in the "${language}" language.

        VERY IMPORTANT: Your entire response must be ONLY a valid JSON array of objects.
        Do not include any text, explanation, or markdown backticks like \`\`\`json.

        Each object in the array must have this exact structure:
        {
          "question": "The question text in ${language}",
          "options": ["An incorrect option", "Another incorrect option", "The correct option", "A third incorrect option"],
          "correctAnswer": "The exact text of the correct option"
        }

        Ensure the "correctAnswer" value is always one of the strings present in the "options" array.
        Shuffle the position of the correct answer within the "options" array for each question.
    `;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://github.com/aakhalidhruv28/Interactive-Quiz-App', 
                'X-Title': 'AI Interactive Quiz App'
            },
            body: JSON.stringify({
                model: "meta-llama/llama-3.1-70b-instruct",
                messages: [{ role: "user", content: prompt }]
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            const errorMsg = errorData?.error?.message || `API Error: ${response.status}`;
            throw new Error(errorMsg);
        }

        const data = await response.json();
        const llmResponse = data.choices[0].message.content;
        
        const parsedQuestions = JSON.parse(llmResponse);
        questions = parsedQuestions.map(q => ({
            question: q.question,
            answers: q.options,
            correct_answer: q.correctAnswer
        }));

    } catch (error) {
        console.error("Error generating quiz with AI:", error);
        questions = [];
        throw error; // Re-throw the error to be caught by startQuiz
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
        button.innerHTML = `<span>${answer}</span>`; // Wrap text in span for icon placement
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
