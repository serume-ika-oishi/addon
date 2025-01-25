// background.js

chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});

const cache = {};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request);

  if (request.action === "translate") {
    if (cache[request.text]) {
      console.log('Using cached translation');
      chrome.tabs.sendMessage(sender.tab.id, {
        action: "showTranslation",
        translation: cache[request.text],
        position: request.position
      });
      return true;
    }

    chrome.storage.local.get('openaiApiKey', function(data) {
      const apiKey = data.openaiApiKey;
      console.log('API Key retrieved:', apiKey ? 'API Key exists' : 'API Key missing');

      if (!apiKey) {
        console.error('API Key is not set');
        chrome.tabs.sendMessage(sender.tab.id, {
          action: "showTranslation",
          translation: "Gemini APIキーが設定されていません。ポップアップから設定してください。",
          position: request.position
        });
        return;
      }

      console.log('Sending request to Gemini API');
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `あなたはプロの翻訳者です。以下の英文を、文脈を考慮しながら自然で流暢な日本語に翻訳してください。
              翻訳の際は以下の点に注意してください：
              1. 原文の意味を正確に伝えること
              2. 日本語として自然な表現を使用すること
              3. 専門用語や固有名詞は適切に処理すること
              4. 文化的な違いを考慮し、必要に応じて説明を加えること
              5. 原文のトーンや雰囲気を可能な限り維持すること

              翻訳対象の英文：
              ${request.text}

              翻訳結果は日本語のみを出力し、説明や注釈は付けないでください。`
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1000
          }
        })
      })
      .then(response => {
        console.log('API Response status:', response.status);
        if (!response.ok) {
          throw new Error(`API Error: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('API Response data:', data);
        if (!data.candidates || !data.candidates[0]?.content?.parts[0]?.text) {
          throw new Error('Invalid API response format');
        }
        const translation = data.candidates[0].content.parts[0].text;
        cache[request.text] = translation;
        console.log('Translation result:', translation);
        chrome.tabs.sendMessage(sender.tab.id, {
          action: "showTranslation",
          translation: translation,
          position: request.position
        });
      })
      .catch((error) => {
        console.error('Translation Error:', error);
        console.error('Error stack:', error.stack);
        console.error('API Response:', error.response);

        let errorMessage = 'Translation Error: ';
        if (error.response) {
          errorMessage += `Status: ${error.response.status}, `;
          errorMessage += `Data: ${JSON.stringify(error.response.data)}`;
        } else if (error.request) {
          errorMessage += 'No response received';
        } else {
          errorMessage += error.message;
        }

        chrome.tabs.sendMessage(sender.tab.id, {
          action: "showTranslation",
          translation: errorMessage,
          position: request.position
        });
      });
    });
  } else if (request.action === "explain") {
    chrome.storage.local.get('openaiApiKey', function(data) {
      const apiKey = data.openaiApiKey;
      if (!apiKey) {
        chrome.tabs.sendMessage(sender.tab.id, {
          action: "showExplanation",
          explanation: "APIキーが設定されていません。"
        });
        return;
      }

      fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `以下の日本語文の中で、"${request.text}"という部分について、50文字以内で簡潔に説明してください。専門用語がある場合は、一般的な言葉で言い換えてください。

              文章全体：
              ${request.context}

              説明が必要な部分：
              ${request.text}`
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1000
          }
        })
      })
      .then(response => response.json())
      .then(data => {
        const explanation = data.candidates[0].content.parts[0].text;
        chrome.tabs.sendMessage(sender.tab.id, {
          action: "showExplanation",
          explanation: explanation
        });
      })
      .catch(error => {
        chrome.tabs.sendMessage(sender.tab.id, {
          action: "showExplanation",
          explanation: `エラー: ${error.message}`
        });
      });
    });
  }
  return true;
});

console.log('Translation Service Worker is active');

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "translateSelection",
    title: "選択テキストを翻訳",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "translateSelection") {
    chrome.tabs.sendMessage(tab.id, {
      action: "translate",
      text: info.selectionText
    });
  }
});
