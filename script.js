// DOM और jsPDF लोड होने का इंतजार
document.addEventListener('DOMContentLoaded', function() {
    const statusEl = document.getElementById('status');
    const quizForm = document.getElementById('quizForm');
    const startQuizBtn = document.getElementById('startQuiz');
    const quizSection = document.getElementById('quizSection');
    const questionText = document.getElementById('questionText');
    const nextButton = document.getElementById('nextButton');
    const generateBtn = document.getElementById('generateQuiz');
    const optionsDiv = document.getElementById('options');

    // jsPDF चेक करें (अगर नहीं लोड, एरर दिखाएँ)
    if (typeof window.jspdf === 'undefined') {
        showError('jsPDF लाइब्रेरी लोड नहीं हुई। jspdf.umd.min.js चेक करें।');
        return;
    }

    // showError फंक्शन (लाइन 119 का एरर फिक्स)
    function showError(message) {
        statusEl.textContent = '❌ एरर: ' + message;
        statusEl.style.color = 'red';
        console.error('Error:', message);
        alert('समस्या: ' + message);  // पॉपअप अलर्ट
    }

    // handleNextButton फंक्शन (लाइन 47 का एरर फिक्स)
    function handleNextButton() {
        // नेक्स्ट प्रश्न लोड करें (उदाहरण: हार्डकोडेड या API से)
        const questions = [
            'पहला प्रश्न: हिंदी में "Hello" क्या कहते हैं?',
            'दूसरा प्रश्न: भारत की राजधानी क्या है?',
            'तीसरा प्रश्न: PDF में हिंदी फॉन्ट कैसे ऐड करें?'
        ];
        const currentQuestionIndex = Math.floor(Math.random() * questions.length);  // रैंडम चुनें
        questionText.textContent = questions[currentQuestionIndex];
        
        // ऑप्शन्स ऐड करें (उदाहरण)
        optionsDiv.innerHTML = `
            <label><input type="radio" name="answer"> विकल्प A</label><br>
            <label><input type="radio" name="answer"> विकल्प B</label><br>
            <label><input type="radio" name="answer"> विकल्प C</label>
        `;
        
        statusEl.textContent = '✅ अगला प्रश्न लोड हो गया!';
        statusEl.style.color = 'green';
        console.log('Next button clicked');
    }

    // क्विज़ स्टार्ट फंक्शन (फॉर्म सबमिट पर)
    function startQuiz(event) {
        event.preventDefault();  // फॉर्म डिफॉल्ट सबमिट रोकें
        try {
            // Netlify फंक्शन से क्विज़ डेटा फेच करें (अगर quiz.js फंक्शन है)
            fetch('/.netlify/functions/quiz')
                .then(response => {
                    if (!response.ok) throw new Error('क्विज़ डेटा लोड नहीं हो सका');
                    return response.json();
                })
                .then(data => {
                    // डेटा से प्रश्न सेट करें (उदाहरण)
                    questionText.textContent = data.question || 'नमस्ते! क्विज़ शुरू: पहला प्रश्न यहाँ।';
                    optionsDiv.innerHTML = data.options ? data.options.map(opt => `<label><input type="radio" name="answer">${opt}</label><br>`).join('') : '';
                    
                    // क्विज़ सेक्शन दिखाएँ
                    quizSection.style.display = 'block';
                    startQuizBtn.style.display = 'none';  // स्टार्ट बटन छुपाएँ
                    statusEl.textContent = '✅ क्विज़ सफलतापूर्वक शुरू हो गया!';
                    statusEl.style.color = 'green';
                })
                .catch(error => {
                    // अगर API फेल, लोकल डेटा यूज करें
                    questionText.textContent = 'डिफॉल्ट प्रश्न: jsPDF में फॉन्ट कैसे ऐड करें?';
                    optionsDiv.innerHTML = '<label><input type="radio" name="answer"> addFont() से</label><br><label><input type="radio" name="answer"> CDN से</label>';
                    quizSection.style.display = 'block';
                    showError('API एरर, लेकिन लोकल क्विज़ चल रहा है: ' + error.message);
                });
        } catch (error) {
            showError('क्विज़ स्टार्ट करने में समस्या: ' + error.message);
        }
    }

    // PDF जेनरेट फंक्शन (हिंदी फॉन्ट के साथ)
    function generateQuizPDF() {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            // हिंदी फॉन्ट सेट करें (अगर उपलब्ध, वरना डिफॉल्ट)
            try {
                doc.setFont('NotoSansDevanagari');  // आपका फॉन्ट नाम
                doc.setFontSize(18);
                doc.text('नमस्ते! क्विज़ रिपोर्ट', 10, 15);  // हिंदी टाइटल
                doc.setFontSize(14);
                doc.text('वर्तमान प्रश्न: ' + questionText.textContent, 10, 25);  // हिंदी प्रश्न
                doc.text('उत्तर विकल्प: ऊपर दिए गए', 10, 35);
            } catch (fontError) {
                console.warn('हिंदी फॉन्ट उपलब्ध नहीं, डिफॉल्ट यूज कर रहे हैं:', fontError);
                doc.setFont('helvetica');
                doc.text('Quiz Report (Hindi font not loaded)', 10, 15);
            }

            // स्कोर ऐड करें (उदाहरण, आपका रियल लॉजिक ऐड करें)
            doc.setFontSize(12);
            doc.text('स्कोर: 90/100', 10, 45);
            doc.text('समाप्ति तिथि: ' + new Date().toLocaleDateString('hi-IN'), 10, 55);

            // PDF सेव करें
            doc.save('quiz-hindi-report.pdf');
            statusEl.textContent = '✅ हिंदी PDF सफलतापूर्वक डाउनलोड हो गया!';
            statusEl.style.color = 'green';
            console.log('PDF generated with Hindi support');
        } catch (error) {
            showError('PDF जेनरेट करने में समस्या: ' + error.message);
            console.error('PDF Error:', error);
        }
    }

    // इवेंट लिस्टनर्स ऐड करें
    if (startQuizBtn) {
        startQuizBtn.addEventListener('click', startQuiz);  // क्विज़ स्टार्ट
    }
    if (nextButton) {
        nextButton.addEventListener('click', handleNextButton);  // नेक्स्ट बटन
    }
    if (generateBtn) {
        generateBtn.addEventListener('click', generateQuizPDF);  // PDF जेनरेट
    }

    // इनिशियल मैसेज
    statusEl.textContent = '🚀 ऐप लोड हो गया। क्विज़ स्टार्ट करें!';
    statusEl.style.color = 'blue';
    console.log('Script.js loaded successfully - All functions defined');
});
