const { Ollama } = require("ollama")
const ollama = new Ollama({ host: 'http://127.0.0.1:11434' });
const fs = require('fs');
const express = require('.pnpm/express@4.21.2/node_modules/express');
const app = express();
const { reply } = require("./render");
const calendar = require('./services/googleCalendar');
const calendarRoutes = require('./routes/calendar');

// 讀取系統提示文件
const systemPrompt = fs.readFileSync('./system_prompt.txt', 'utf-8');

// 設置 Express 中間件來解析 JSON
app.use(express.json());

// 新增 OAuth 回調路由
app.get('/oauth2callback', (req, res) => {
  const code = req.query.code;
  if (code) {
    calendar.handleOAuthCallback(code);
    res.send('授權成功！您可以關閉此視窗。');
  } else {
    res.status(400).send('未收到授權碼');
  }
});

// 處理 POST 請求
app.post('/chat', async (req, res) => {
  try {
    let response = await ollama.chat({
      model: 'qwen2.5:32b',
      messages: [
        {
          role: 'system',
          content: 'Current Time: '+Date()
        },
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: req.body.message
        }
      ],
      keep_alive: -1,
      options: {
        temperature: 0.7,    // 控制輸出的隨機性 (0-1)
        top_p: 0.9,         // 控制輸出的多樣性
        top_k: 40,          // 限制每次選擇的候選詞數量
        repeat_penalty: 1.1, // 降低重複內容的可能性
        seed: 5,           // 固定隨機種子以獲得可重複的結果
        num_predict: 100,    // 生成的最大token數量
      }
    });
    
    res.json(await reply(ollama, response, [
      {
        role: 'system',
        content: 'Current Time: '+Date()
      },
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: req.body.message
      },
      {
        role: 'assistant',
        content: response.message.content
      }
    ]));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 新增停止模型的端點
app.post('/stop', async (req, res) => {
  try {
    const response = await ollama.chat({
      model: 'qwen2.5:32b',
      keep_alive: 0  // 設置為 0 來停止模型
    });
    
    res.json({ status: 'success', message: '模型已停止' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 新增啟動模型的端點
app.post('/start', async (req, res) => {
  try {
    const response = await ollama.chat({
      model: 'qwen2.5:32b',
      keep_alive: -1  // 設置為 -1 來保持模型運行
    });
    
    res.json({ status: 'success', message: '模型已啟動' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 加入日曆路由
app.use('/calendar', calendarRoutes);

// 啟動服務器
const PORT = process.env.PORT || 55168;
app.listen(PORT, () => {
  console.log(`服務器運行在端口 ${PORT}`);
});
