// p5.js 響應式選擇題測驗系統：題目由 questions.csv 載入。
// 中文與非 ASCII 字元使用 LXGW WenKai Mono TC；ASCII 英文、數字與標點使用 Isometra。

const FONT_CJK = "LXGW WenKai Mono TC";
const FONT_LATIN = "Isometra";
const FONT_FALLBACK_CJK = "LXGW WenKai Mono TC, Noto Sans TC, sans-serif";
const FONT_FALLBACK_LATIN = "Isometra, ui-monospace, SFMono-Regular, Consolas, monospace, sans-serif";
const REQUIRED_COLUMNS = ["question", "option1", "option2", "option3", "option4", "answer"];
const QUIZ_SIZE = 5;

let questionTable = null;
let allQuestions = [];
let questions = [];
let questionLoadError = "";
let validationMessages = [];
let appState = "loading";

let currentQuestion = 0;
let hasAnswered = false;
let currentAnswerCorrect = false;
let selectedAnswer = -1;
let score = 0;
let animationStartFrame = 0;
let canvasElement;
let canvasParent;
let lastTouchTime = -1000;

// preload() 會在 setup() 前執行，確保題庫完成載入後才開始建立測驗。
function preload() {
  questionTable = loadTable(
    "questions.csv",
    "csv",
    "header",
    function loaded(table) {
      questionTable = table;
    },
    function failed(error) {
      questionLoadError = "無法載入 questions.csv，請確認檔案與 index.html 位於同一個資料夾。";
      console.error("questions.csv 載入失敗：", error);
    }
  );
}

// p5.js 初始化函式。
function setup() {
  document.documentElement.style.margin = "0";
  document.body.style.margin = "0";
  document.body.style.width = "100%";
  document.body.style.height = "100%";
  document.body.style.overflow = "hidden";
  document.body.style.touchAction = "none";

  canvasParent = document.getElementById("p5-responsive-quiz-canvas");
  if (!canvasParent) {
    canvasParent = document.createElement("main");
    canvasParent.id = "p5-responsive-quiz-canvas";
    document.body.appendChild(canvasParent);
  }
  canvasParent.style.width = "100vw";
  canvasParent.style.height = "100vh";
  canvasParent.style.position = "fixed";
  canvasParent.style.left = "0";
  canvasParent.style.top = "0";
  canvasParent.style.overflow = "hidden";
  canvasParent.style.touchAction = "none";

  pixelDensity(getSafePixelDensity());
  canvasElement = createCanvas(getViewportWidth(), getViewportHeight());
  canvasElement.parent(canvasParent);
  canvasElement.elt.style.width = "100%";
  canvasElement.elt.style.height = "100%";
  canvasElement.elt.style.display = "block";
  canvasElement.elt.style.touchAction = "none";
  canvasElement.elt.setAttribute("aria-label", "p5.js 程式設計指令練習測驗");

  noStroke();
  textAlign(CENTER, CENTER);
  textSize(20);
  applyFont(FONT_LATIN);

  parseQuestionTable();
  if (allQuestions.length > 0) {
    startQuiz();
    appState = "ready";
  } else {
    appState = "error";
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.catch(function (error) {
      console.warn("Google Fonts 載入未完成，將使用備用字型：", error);
    });
  }
}

// 將 CSV 的每一列驗證並轉成 { question, options, answer }。
function parseQuestionTable() {
  if (questionLoadError || !questionTable) {
    if (!questionLoadError) {
      questionLoadError = "找不到題庫資料，請確認 questions.csv 存在且可讀取。";
    }
    console.error(questionLoadError);
    return;
  }

  const columns = Array.isArray(questionTable.columns) ? questionTable.columns : [];
  const missingColumns = REQUIRED_COLUMNS.filter(function (column) {
    return !columns.includes(column);
  });
  if (missingColumns.length > 0) {
    questionLoadError = "CSV 缺少必要欄位：" + missingColumns.join(", ");
    console.error(questionLoadError, "目前欄位：", columns);
    return;
  }

  for (let rowIndex = 0; rowIndex < questionTable.getRowCount(); rowIndex += 1) {
    const rowNumber = rowIndex + 2;
    const questionText = getTableValue(rowIndex, "question");
    const options = [
      getTableValue(rowIndex, "option1"),
      getTableValue(rowIndex, "option2"),
      getTableValue(rowIndex, "option3"),
      getTableValue(rowIndex, "option4")
    ];
    const answerText = getTableValue(rowIndex, "answer").trim();

    if (!questionText.trim()) {
      addValidationWarning("第 " + rowNumber + " 列的 question 為空白，已略過。", rowNumber);
      continue;
    }
    if (options.some(function (option) { return !option.trim(); })) {
      addValidationWarning("第 " + rowNumber + " 列有空白選項，已略過。", rowNumber);
      continue;
    }
    if (!/^[0-3]$/.test(answerText)) {
      addValidationWarning("第 " + rowNumber + " 列的 answer 必須是 0 到 3，已略過。", rowNumber);
      continue;
    }

    allQuestions.push({
      question: questionText,
      options: options,
      answer: Number(answerText)
    });
  }

  if (allQuestions.length === 0) {
    questionLoadError = "題庫沒有可使用的題目，請檢查 CSV 內容與欄位。";
    console.error(questionLoadError, validationMessages);
  }
}

function getTableValue(rowIndex, columnName) {
  const value = questionTable.getString(rowIndex, columnName);
  return value === undefined || value === null ? "" : String(value);
}

function addValidationWarning(message, rowNumber) {
  validationMessages.push(message);
  console.error("questions.csv 驗證錯誤（第 " + rowNumber + " 列）：" + message);
}

// 每次開始或重新開始時，複製完整題庫、洗牌，再取前五題。
function startQuiz() {
  const shuffledQuestions = shuffle(allQuestions.slice());
  questions = shuffledQuestions.slice(0, Math.min(QUIZ_SIZE, shuffledQuestions.length));
  currentQuestion = 0;
  hasAnswered = false;
  currentAnswerCorrect = false;
  selectedAnswer = -1;
  score = 0;
  animationStartFrame = frameCount;
}

function getViewportWidth() {
  return Math.max(1, Math.floor(window.innerWidth || windowWidth));
}

function getViewportHeight() {
  return Math.max(1, Math.floor(window.innerHeight || windowHeight));
}

function getSafePixelDensity() {
  const deviceRatio = Number(window.devicePixelRatio) || 1;
  return Math.min(Math.max(deviceRatio, 1), 2);
}

function windowResized() {
  pixelDensity(getSafePixelDensity());
  resizeCanvas(getViewportWidth(), getViewportHeight());
}

// ------------------------------
// 中英混合字型繪製與測量
// ------------------------------

function isAsciiCharacter(character) {
  return /^[\x00-\x7F]$/.test(character);
}

function splitTextByFont(sourceText) {
  const segments = [];
  let currentText = "";
  let currentFont = "";

  for (const character of String(sourceText)) {
    const fontName = isAsciiCharacter(character) ? FONT_LATIN : FONT_CJK;
    if (currentText && currentFont !== fontName) {
      segments.push({ text: currentText, font: currentFont });
      currentText = "";
    }
    currentText += character;
    currentFont = fontName;
  }
  if (currentText) {
    segments.push({ text: currentText, font: currentFont });
  }
  return segments;
}

function applyFont(fontName) {
  textFont(fontName === FONT_CJK ? FONT_FALLBACK_CJK : FONT_FALLBACK_LATIN);
}

function measureMixedText(sourceText, fontSize) {
  textSize(fontSize);
  let totalWidth = 0;
  for (const segment of splitTextByFont(sourceText)) {
    applyFont(segment.font);
    totalWidth += textWidth(segment.text);
  }
  return totalWidth;
}

function drawMixedText(sourceText, centerX, centerY, fontSize, fillColor) {
  const segments = splitTextByFont(sourceText);
  const totalWidth = measureMixedText(sourceText, fontSize);
  let cursorX = centerX - totalWidth / 2;

  fill(fillColor);
  textSize(fontSize);
  textAlign(LEFT, CENTER);
  for (const segment of segments) {
    applyFont(segment.font);
    text(segment.text, cursorX, centerY);
    cursorX += textWidth(segment.text);
  }
  textAlign(CENTER, CENTER);
}

function wrapTextByWidth(sourceText, maxWidth, fontSize) {
  const lines = [];
  let currentLine = "";
  const safeWidth = Math.max(1, maxWidth);

  for (const character of String(sourceText)) {
    if (character === "\n") {
      lines.push(currentLine);
      currentLine = "";
      continue;
    }
    const previewLine = currentLine + character;
    if (currentLine && measureMixedText(previewLine, fontSize) > safeWidth) {
      lines.push(currentLine);
      currentLine = character;
    } else {
      currentLine = previewLine;
    }
  }
  if (currentLine || lines.length === 0) {
    lines.push(currentLine);
  }
  return lines;
}

function drawMixedLines(lines, centerX, centerY, lineHeight, fontSize, fillColor) {
  const totalHeight = Math.max(0, (lines.length - 1) * lineHeight);
  lines.forEach(function (line, index) {
    drawMixedText(line, centerX, centerY - totalHeight / 2 + index * lineHeight, fontSize, fillColor);
  });
}

function clampValue(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

// ------------------------------
// 響應式版面
// ------------------------------

function getLayout() {
  const canvasWidth = Math.max(1, width);
  const canvasHeight = Math.max(1, height);
  const outerMargin = clampValue(Math.min(canvasWidth * 0.05, canvasHeight * 0.035), 6, 48);
  const contentWidth = Math.max(1, canvasWidth - outerMargin * 2);
  let fitScale = clampValue(Math.min(canvasWidth / 480, canvasHeight / 760), 0.34, 1.15);
  let layout = null;
  const current = questions[currentQuestion];

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const titleSize = Math.max(8, Math.min(34, canvasWidth * 0.055, canvasHeight * 0.075) * fitScale);
    const progressSize = Math.max(7, Math.min(21, canvasWidth * 0.034, canvasHeight * 0.045) * fitScale);
    const headerTop = Math.max(3, outerMargin * 0.55);
    const titleY = headerTop + titleSize * 0.6;
    const progressY = titleY + titleSize * 0.72 + progressSize * 0.75;
    const headerGap = Math.max(3, Math.min(18, canvasHeight * 0.018) * fitScale);

    const questionTextSize = Math.max(8, Math.min(30, canvasWidth * 0.045, canvasHeight * 0.062) * fitScale);
    const questionWidth = Math.min(contentWidth, 900);
    const questionPadding = Math.max(5, Math.min(28, canvasWidth * 0.035, canvasHeight * 0.04) * fitScale);
    const questionLines = wrapTextByWidth(current.question, questionWidth - questionPadding * 2, questionTextSize);
    const questionLineHeight = Math.max(9, questionTextSize * 1.38);
    const questionHeight = Math.max(questionLineHeight + questionPadding * 2, questionLines.length * questionLineHeight + questionPadding * 2);
    const questionY = progressY + progressSize * 0.55 + headerGap;

    const optionTextSize = Math.max(7, Math.min(23, canvasWidth * 0.035, canvasHeight * 0.043) * fitScale);
    const optionWidth = Math.min(contentWidth, 720);
    const optionPadding = Math.max(4, Math.min(20, canvasWidth * 0.025) * fitScale);
    const optionTextWidth = Math.max(1, optionWidth - optionPadding * 2);
    const optionLineHeight = Math.max(8, optionTextSize * 1.25);
    const optionLines = [];
    let maximumOptionLines = 1;

    current.options.forEach(function (optionText, optionIndex) {
      const label = String.fromCharCode(65 + optionIndex) + ". " + optionText;
      const lines = wrapTextByWidth(label, optionTextWidth, optionTextSize);
      optionLines.push(lines);
      maximumOptionLines = Math.max(maximumOptionLines, lines.length);
    });

    const optionHeight = Math.max(12, Math.min(64, Math.max(canvasHeight * 0.075, maximumOptionLines * optionLineHeight + optionPadding * 2) * fitScale));
    const optionGap = Math.max(2, Math.min(20, canvasHeight * 0.019) * fitScale);
    const questionToOptionsGap = Math.max(4, Math.min(28, canvasHeight * 0.035) * fitScale);
    const firstOptionY = questionY + questionHeight + questionToOptionsGap;
    const optionsHeight = current.options.length * optionHeight + (current.options.length - 1) * optionGap;
    const buttonHeight = Math.max(20, Math.min(60, canvasHeight * 0.075) * fitScale);
    const buttonWidth = Math.min(optionWidth, Math.max(110, Math.min(280, canvasWidth * 0.46)) * fitScale);
    const buttonGap = Math.max(4, Math.min(24, canvasHeight * 0.03) * fitScale);
    const bottomMargin = Math.max(3, outerMargin * 0.55);
    const buttonAreaHeight = hasAnswered ? buttonGap + buttonHeight : 0;

    layout = {
      canvasWidth: canvasWidth,
      canvasHeight: canvasHeight,
      titleSize: titleSize,
      titleY: titleY,
      progressSize: progressSize,
      progressY: progressY,
      question: {
        x: (canvasWidth - questionWidth) / 2,
        y: questionY,
        width: questionWidth,
        height: questionHeight,
        textSize: questionTextSize,
        lineHeight: questionLineHeight,
        lines: questionLines
      },
      optionLines: optionLines,
      optionTextSize: optionTextSize,
      optionLineHeight: optionLineHeight,
      optionWidth: optionWidth,
      optionHeight: optionHeight,
      optionGap: optionGap,
      firstOptionY: firstOptionY,
      nextButton: {
        x: (canvasWidth - buttonWidth) / 2,
        y: Math.min(canvasHeight - bottomMargin - buttonHeight, firstOptionY + optionsHeight + buttonGap),
        width: buttonWidth,
        height: buttonHeight
      },
      buttonTextSize: clampValue(buttonHeight * 0.38, 8, 22),
      bottomMargin: bottomMargin,
      scale: fitScale
    };

    const requiredHeight = firstOptionY + optionsHeight + buttonAreaHeight + bottomMargin;
    if (requiredHeight <= canvasHeight - 1) {
      break;
    }
    fitScale = Math.max(0.22, fitScale * Math.min(0.92, (canvasHeight - bottomMargin) / Math.max(requiredHeight, 1)));
  }

  const elapsedFrames = frameCount - animationStartFrame;
  const verticalAmplitude = hasAnswered && !currentAnswerCorrect ? Math.min(layout.optionGap * 0.35, layout.optionHeight * 0.18) : 0;
  const horizontalAmplitude = hasAnswered && !currentAnswerCorrect ? Math.min(14 * layout.scale, Math.max(0, (canvasWidth - layout.optionWidth) / 2 - 2)) : 0;
  layout.options = [];

  current.options.forEach(function (optionText, optionIndex) {
    const baseY = layout.firstOptionY + optionIndex * (layout.optionHeight + layout.optionGap);
    let horizontalOffset = 0;
    let verticalOffset = 0;
    if (hasAnswered && !currentAnswerCorrect && optionIndex === current.answer) {
      verticalOffset = Math.sin(elapsedFrames * 0.18) * verticalAmplitude;
    }
    if (hasAnswered && !currentAnswerCorrect && optionIndex === selectedAnswer) {
      horizontalOffset = Math.sin(elapsedFrames * 0.22) * horizontalAmplitude;
    }
    layout.options.push({
      index: optionIndex,
      x: (canvasWidth - layout.optionWidth) / 2 + horizontalOffset,
      y: baseY + verticalOffset,
      width: layout.optionWidth,
      height: layout.optionHeight,
      lines: layout.optionLines[optionIndex]
    });
  });
  return layout;
}

function getResultLayout() {
  const canvasWidth = Math.max(1, width);
  const canvasHeight = Math.max(1, height);
  const buttonWidth = Math.min(Math.max(120, canvasWidth * 0.46), 280);
  const buttonHeight = clampValue(Math.min(canvasHeight * 0.09, 60), 24, 60);
  return {
    canvasWidth: canvasWidth,
    canvasHeight: canvasHeight,
    resultTitleSize: clampValue(Math.min(canvasWidth * 0.08, canvasHeight * 0.12), 12, 48),
    resultTitleY: canvasHeight * 0.29,
    resultScoreSize: clampValue(Math.min(canvasWidth * 0.06, canvasHeight * 0.08), 10, 36),
    resultScoreY: canvasHeight * 0.43,
    restartButton: {
      x: (canvasWidth - buttonWidth) / 2,
      y: Math.min(canvasHeight * 0.62, canvasHeight - buttonHeight - 8),
      width: buttonWidth,
      height: buttonHeight
    },
    resultButtonTextSize: clampValue(buttonHeight * 0.38, 9, 22)
  };
}

function getCurrentInteractionLayout() {
  return currentQuestion >= questions.length ? getResultLayout() : getLayout();
}

// ------------------------------
// 畫面繪製
// ------------------------------

function draw() {
  background("#f7f7f7");

  if (appState === "error") {
    drawErrorScreen();
    return;
  }
  if (appState !== "ready" || questions.length === 0) {
    drawLoadingScreen();
    return;
  }
  if (currentQuestion >= questions.length) {
    drawResultScreen(getResultLayout());
    return;
  }

  const layout = getLayout();
  drawTitle(layout);
  drawQuestion(layout);
  drawOptions(layout);
  if (hasAnswered) {
    drawNextButton(layout);
  }
}

function drawLoadingScreen() {
  drawMixedText("正在載入題庫…", width / 2, height / 2, clampValue(Math.min(width * 0.07, 32), 14, 32), "#222222");
}

function drawErrorScreen() {
  const titleSize = clampValue(Math.min(width * 0.07, 34), 14, 34);
  const bodySize = clampValue(Math.min(width * 0.038, 20), 10, 20);
  drawMixedText("題庫載入失敗", width / 2, height * 0.30, titleSize, "#b00020");
  const message = questionLoadError || "請檢查 questions.csv。";
  const lines = wrapTextByWidth(message, Math.max(160, width * 0.82), bodySize);
  drawMixedLines(lines, width / 2, height * 0.47, bodySize * 1.45, bodySize, "#333333");
  if (validationMessages.length > 0) {
    drawMixedText("詳細錯誤請查看瀏覽器主控台。", width / 2, height * 0.70, bodySize, "#555555");
  }
}

function drawTitle(layout) {
  drawMixedText("p5.js 程式設計指令練習測驗", layout.canvasWidth / 2, layout.titleY, layout.titleSize, "#222222");
  drawMixedText("第 " + (currentQuestion + 1) + " 題，共 " + questions.length + " 題", layout.canvasWidth / 2, layout.progressY, layout.progressSize, "#222222");
}

function drawQuestion(layout) {
  fill("#bdb2ff");
  rect(layout.question.x, layout.question.y, layout.question.width, layout.question.height, Math.min(14, layout.question.height * 0.18));
  drawMixedLines(layout.question.lines, layout.question.x + layout.question.width / 2, layout.question.y + layout.question.height / 2, layout.question.lineHeight, layout.question.textSize, "#222222");
}

function drawOptions(layout) {
  const question = questions[currentQuestion];
  layout.options.forEach(function (option) {
    setOptionColor(option.index);
    rect(option.x, option.y, option.width, option.height, Math.min(14, option.height * 0.22));
    drawMixedLines(option.lines, option.x + option.width / 2, option.y + option.height / 2, layout.optionLineHeight, layout.optionTextSize, "#222222");
  });
}

function setOptionColor(optionIndex) {
  if (!hasAnswered) {
    fill("#e8e8e8");
    return;
  }
  const question = questions[currentQuestion];
  if (currentAnswerCorrect) {
    fill(optionIndex === question.answer ? "#b6f2b6" : "#e8e8e8");
    return;
  }
  if (optionIndex === question.answer) {
    fill("#fdffb6");
    return;
  }
  if (optionIndex === selectedAnswer) {
    fill("#ff4d6d");
    return;
  }
  fill("#e8e8e8");
}

function drawNextButton(layout) {
  fill("#4d96ff");
  rect(layout.nextButton.x, layout.nextButton.y, layout.nextButton.width, layout.nextButton.height, Math.min(14, layout.nextButton.height * 0.22));
  const label = currentQuestion === questions.length - 1 ? "查看結果" : "下一題";
  drawMixedText(label, layout.nextButton.x + layout.nextButton.width / 2, layout.nextButton.y + layout.nextButton.height / 2, layout.buttonTextSize, "#ffffff");
}

function drawResultScreen(layout) {
  drawMixedText("測驗結束！", layout.canvasWidth / 2, layout.resultTitleY, layout.resultTitleSize, "#222222");
  drawMixedText("你答對了 " + score + " / " + questions.length + " 題", layout.canvasWidth / 2, layout.resultScoreY, layout.resultScoreSize, "#222222");
  fill("#4d96ff");
  rect(layout.restartButton.x, layout.restartButton.y, layout.restartButton.width, layout.restartButton.height, Math.min(14, layout.restartButton.height * 0.22));
  drawMixedText("重新開始", layout.restartButton.x + layout.restartButton.width / 2, layout.restartButton.y + layout.restartButton.height / 2, layout.resultButtonTextSize, "#ffffff");
}

// ------------------------------
// 滑鼠、觸控與防重複觸發
// ------------------------------

function mousePressed() {
  if (millis() - lastTouchTime < 500) {
    return false;
  }
  handleInput(mouseX, mouseY);
  return false;
}

function touchStarted() {
  lastTouchTime = millis();
  handleInput(mouseX, mouseY);
  return false;
}

function isPointInsideRectangle(inputX, inputY, rectangle) {
  return inputX >= rectangle.x && inputX <= rectangle.x + rectangle.width && inputY >= rectangle.y && inputY <= rectangle.y + rectangle.height;
}

function handleInput(inputX, inputY) {
  if (appState !== "ready" || questions.length === 0) {
    return;
  }

  const layout = getCurrentInteractionLayout();
  if (currentQuestion >= questions.length) {
    if (isPointInsideRectangle(inputX, inputY, layout.restartButton)) {
      startQuiz();
    }
    return;
  }

  if (hasAnswered) {
    if (isPointInsideRectangle(inputX, inputY, layout.nextButton)) {
      currentQuestion += 1;
      hasAnswered = false;
      currentAnswerCorrect = false;
      selectedAnswer = -1;
      animationStartFrame = frameCount;
    }
    return;
  }

  for (const option of layout.options) {
    if (!isPointInsideRectangle(inputX, inputY, option)) {
      continue;
    }
    selectedAnswer = option.index;
    hasAnswered = true;
    animationStartFrame = frameCount;
    currentAnswerCorrect = selectedAnswer === questions[currentQuestion].answer;
    if (currentAnswerCorrect) {
      score += 1;
    }
    break;
  }
}
