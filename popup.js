document.getElementById('saveApiKey').addEventListener('click', function() {
  const apiKey = document.getElementById('apiKey').value;
  if (!apiKey) {
    alert('Gemini APIキーを入力してください');
    return;
  }
  chrome.storage.local.set({openaiApiKey: apiKey}, function() {
    const status = document.createElement('div');
    status.textContent = 'Gemini APIキーが保存されました';
    status.style.color = 'green';
    status.style.marginTop = '10px';
    document.body.appendChild(status);
    setTimeout(() => {
      status.remove();
    }, 2000);
  });
});

chrome.storage.local.get('openaiApiKey', function(data) {
  if (data.openaiApiKey) {
    document.getElementById('apiKey').value = data.openaiApiKey;
  }
});
// 翻訳リクエスト送信時
chrome.runtime.sendMessage({
  action: "translate",
  text: selectedText
});

const loadingElement = document.createElement('div');
loadingElement.className = 'loader';
loadingElement.id = 'translation-loader';
document.body.appendChild(loadingElement);

// 翻訳結果受信時
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "showTranslation") {
    const translationResult = document.getElementById('translationResult');
    if (request.translation.startsWith('翻訳エラー:')) {
      translationResult.innerHTML = `<p style="color: red;">${request.translation}</p>`;
    } else {
      translationResult.innerHTML = `<p><strong>翻訳結果:</strong><br>${request.translation}</p>`;
    }
  }
});

function toggleApiKeyVisibility() {
  const apiKeyInput = document.getElementById('apiKey');
  const toggleButton = document.querySelector('.toggle-visibility');

  if (apiKeyInput.type === 'password') {
    apiKeyInput.type = 'text';
    toggleButton.textContent = '🔒';
  } else {
    apiKeyInput.type = 'password';
    toggleButton.textContent = '👁️';
  }
}

// 既存のコードの後に以下を追加
document.addEventListener('DOMContentLoaded', function() {
  const apiKeyInput = document.getElementById('apiKey');
  apiKeyInput.type = 'password';
});

function copyToClipboard(text) {
  const tempInput = document.createElement('input');
  tempInput.style.position = 'absolute';
  tempInput.style.left = '-9999px';
  document.body.appendChild(tempInput);
  tempInput.value = text;
  tempInput.select();
  document.execCommand('copy');
  document.body.removeChild(tempInput);
  alert('アドレスがクリップボードにコピーされました');
}

function addCopyListeners() {
  const addresses = document.querySelectorAll('.address');
  addresses.forEach(address => {
    address.addEventListener('click', function() {
      const fullAddress = this.getAttribute('data-full-address');
      copyToClipboard(fullAddress);
    });
  });
}

// DOMContentLoadedイベントリスナーの中に移動
document.addEventListener('DOMContentLoaded', function() {
  const apiKeyInput = document.getElementById('apiKey');
  apiKeyInput.type = 'password';

  // コピー機能のリスナーを追加
  addCopyListeners();
});
