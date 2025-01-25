// content.js

// スタイルを追加
const style = document.createElement('style');
style.textContent = `
  .tooltip {
    position: absolute;
    padding: 10px;
    border-radius: 5px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    z-index: 10001;
    max-width: 250px;
    font-family: Arial, sans-serif;
    color: #ECF0F1; /* 基本文字色は白系（必要に応じて変更） */
  }

  /* 通常の翻訳用（例） */
  .tooltip:not(.loading) {
    background-color: #34495E;
  }

  /* ローディング時ツールチップ */
  .tooltip.loading {
    background-color: rgba(0,0,0,0.6); /* 半透明黒背景 */
    display: flex;
    align-items: center;
  }

  /* スピナー用アニメーション */
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* スピナー本体 */
  .tooltip.loading::before {
    content: "";
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid #999;      /* 薄めのグレー */
    border-top: 2px solid #fff;  /* 白 */
    border-radius: 50%;
    margin-right: 8px;
    animation: spin 1s linear infinite;
  }

  /* #translation-result (翻訳結果ウィンドウ) のスタイル例 */
  #translation-result {
    position: absolute;
    background-color: #2C3E50;
    color: #ECF0F1;
    padding: 15px;
    border-radius: 5px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    z-index: 10000;
    max-width: 300px;
    font-family: Arial, sans-serif;
  }
  #translation-result .close-button {
    font-size: 20px;
    color: #ECF0F1;
    opacity: 0.7;
    transition: opacity 0.2s;
  }
  #translation-result .close-button:hover {
    opacity: 1;
  }

  /* 通常 tooltip 内ボタン */
  .tooltip .close-button {
    font-size: 16px;
    opacity: 0.7;
    transition: opacity 0.2s;
    float: right;
    margin-left: 5px;
    cursor: pointer;
  }
  .tooltip .close-button:hover {
    opacity: 1;
  }
`;
document.head.appendChild(style);

// ---------------------------------------------------
// (1) キー操作で翻訳を呼び出す
// ---------------------------------------------------
document.addEventListener('keydown', (e) => {
  if (e.key === '5') {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText) {
      const range = window.getSelection().getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // 「翻訳中…」の半透明ローディングツールチップを出す
      showTooltip('翻訳中...', rect, { loading: true });

      // バックグラウンドへ翻訳依頼
      chrome.runtime.sendMessage({
        action: "translate",
        text: selectedText
      });
    }
  }
});

// ---------------------------------------------------
// (2) バックグラウンドからの応答を処理
// ---------------------------------------------------
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "showTranslation") {
    showTranslationResult(request.translation);
  } else if (request.action === "showExplanation") {
    updateTooltip(request.explanation);
  }
});

// ---------------------------------------------------
// (3) 翻訳結果を表示
// ---------------------------------------------------
function showTranslationResult(translation) {
  const loadingTooltip = document.querySelector('.tooltip.loading');
  if (loadingTooltip) {
    loadingTooltip.remove();
  }
  let resultElement = document.getElementById('translation-result');
  if (resultElement) {
    resultElement.remove();
  }

  resultElement = document.createElement('div');
  resultElement.id = 'translation-result';

  // 閉じるボタン
  const closeButton = document.createElement('span');
  closeButton.textContent = '×';
  closeButton.style.cursor = 'pointer';
  closeButton.style.float = 'right';
  closeButton.style.marginLeft = '10px';
  closeButton.onclick = () => resultElement.remove();

  // 翻訳テキストを整形して表示
  const formattedTranslation = formatTranslation(translation);
  resultElement.innerHTML = formattedTranslation;
  resultElement.insertBefore(closeButton, resultElement.firstChild);

  // 選択範囲の位置を取得
  const selection = window.getSelection();
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  // スクロールオフセット
  const scrollTop  = window.scrollY || window.pageYOffset;
  const scrollLeft = window.scrollX || window.pageXOffset;
  const topOffset  = rect.top + scrollTop;
  const leftOffset = rect.right + 10 + scrollLeft;

  // 絶対座標で配置
  resultElement.style.position = 'absolute';
  resultElement.style.left = `${leftOffset}px`;
  resultElement.style.top  = `${topOffset}px`;

  document.body.appendChild(resultElement);

  // 訳文上でマウスアップしたときに解説を呼び出す
  resultElement.addEventListener('mouseup', handleTranslationSelection);

  // はみ出し対策
  const resultRect = resultElement.getBoundingClientRect();
  if (resultRect.right > window.innerWidth) {
    resultElement.style.left = `${window.innerWidth - resultRect.width - 10 + scrollLeft}px`;
  }
  if (resultRect.bottom > window.innerHeight) {
    resultElement.style.top = `${rect.top - resultRect.height - 5 + scrollTop}px`;
  }
}

// ---------------------------------------------------
// (4) 翻訳テキストの一部を選択して解説を呼び出す
// ---------------------------------------------------
function handleTranslationSelection(e) {
  const selectedText = window.getSelection().toString().trim();
  if (selectedText) {
    const range = window.getSelection().getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // 解説リクエスト中… tooltip
    showTooltip('解説を取得中...', rect, { loading: true });

    // バックグラウンドに解説を問い合わせ
    chrome.runtime.sendMessage({
      action: "explain",
      text: selectedText,
      context: document.getElementById('translation-result').textContent
    });
  }
}

// ---------------------------------------------------
// (5) 汎用ツールチップ表示関数
//    第3引数に { loading: true } があれば「ローディング」スタイルを付与
// ---------------------------------------------------
function showTooltip(text, rect, options = {}) {
  // 既存ツールチップを削除
  let tooltip = document.querySelector('.tooltip');
  if (tooltip) {
    tooltip.remove();
  }

  tooltip = document.createElement('div');
  tooltip.className = 'tooltip';

  // ローディングなら専用クラス追加
  if (options.loading) {
    tooltip.classList.add('loading');
  }

  tooltip.textContent = text;

  // スクロール分を考慮
  const scrollTop  = window.scrollY || window.pageYOffset;
  const scrollLeft = window.scrollX || window.pageXOffset;
  const topOffset  = rect.bottom + 5 + scrollTop;
  const leftOffset = rect.right + 10 + scrollLeft;

  tooltip.style.left = `${leftOffset}px`;
  tooltip.style.top  = `${topOffset}px`;

  // DOMに追加
  document.body.appendChild(tooltip);

  // はみ出し対策
  const tooltipRect = tooltip.getBoundingClientRect();
  if (tooltipRect.right > window.innerWidth) {
    tooltip.style.left = `${window.innerWidth - tooltipRect.width - 10 + scrollLeft}px`;
  }
  if (tooltipRect.bottom > window.innerHeight) {
    tooltip.style.top = `${rect.top - tooltipRect.height - 5 + scrollTop}px`;
  }

  // 閉じるボタン
  const closeButton = document.createElement('span');
  closeButton.textContent = '×';
  closeButton.className = 'close-button';
  closeButton.onclick = () => tooltip.remove();
  tooltip.insertBefore(closeButton, tooltip.firstChild);

  // 5秒後に自動的に削除
  setTimeout(() => {
    if (tooltip && tooltip.parentNode) {
      tooltip.remove();
    }
  }, 5000);
}

// ---------------------------------------------------
// (6) ツールチップの内容を更新
// ---------------------------------------------------
function updateTooltip(text) {
  const tooltip = document.querySelector('.tooltip');
  if (tooltip) {
    // ローディング外すならここで .loading を外してもOK
    tooltip.classList.remove('loading');
    tooltip.textContent = text;

    // 再度閉じるボタンをつけておきたいなら:
    const closeButton = document.createElement('span');
    closeButton.textContent = '×';
    closeButton.className = 'close-button';
    closeButton.onclick = () => tooltip.remove();
    tooltip.insertBefore(closeButton, tooltip.firstChild);
  }
}

// ---------------------------------------------------
// (7) 翻訳テキストの整形
// ---------------------------------------------------
function formatTranslation(text) {
  const paragraphs = text.split('\n\n');
  const formattedParagraphs = paragraphs.map(paragraph => {
    paragraph = paragraph.replace(/\n/g, '<br>');
    paragraph = paragraph.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    paragraph = paragraph.replace(/_(.*?)_/g, '<em>$1</em>');
    return `<p>${paragraph}</p>`;
  });
  return formattedParagraphs.join('');
}

// ---------------------------------------------------
// (8) ツールチップを閉じる（余計なクリックで消えるように）
// ---------------------------------------------------
document.addEventListener('mousedown', (e) => {
  if (!e.target.closest('.tooltip') && !e.target.closest('#translation-result')) {
    const tooltip = document.querySelector('.tooltip');
    if (tooltip) {
      tooltip.remove();
    }
  }
});
