const express = require('express');
const router = express.Router();
const calendar = require('../services/googleCalendar');

// 格式化日期輸出
function formatEvent(event) {
  return {
    標題: event.summary,
    開始時間: new Date(event.start).toLocaleString('zh-TW'),
    結束時間: new Date(event.end).toLocaleString('zh-TW'),
    地點: event.location || '無地點',
    描述: event.description || '無描述',
    Google日曆連結: event.htmlLink || ''
  };
}

// 取得今日行程
router.get('/today', async (req, res) => {
  try {
    const events = await calendar.getDayEvents(new Date());
    res.json({
      日期: new Date().toLocaleDateString('zh-TW'),
      行程總數: events.length,
      行程列表: events
    });
  } catch (error) {
    res.status(500).json({ error: '取得今日行程失敗', message: error.message });
  }
});

// 取得指定日期行程
router.get('/date/:date', async (req, res) => {
  try {
    const date = new Date(req.params.date);
    if (isNaN(date.getTime())) {
      return res.status(400).json({ error: '日期格式無效' });
    }
    
    const events = await calendar.getDayEvents(date);
    res.json({
      日期: date.toLocaleDateString('zh-TW'),
      行程總數: events.length,
      行程列表: events.map(formatEvent)
    });
  } catch (error) {
    res.status(500).json({ error: '取得行程失敗', message: error.message });
  }
});

// 取得本週行程
router.get('/week', async (req, res) => {
  try {
    const events = await calendar.getWeekEvents(new Date());
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    
    res.json({
      週起始日: startOfWeek.toLocaleDateString('zh-TW'),
      行程總數: events.length,
      行程列表: events.map(formatEvent)
    });
  } catch (error) {
    res.status(500).json({ error: '取得本週行程失敗', message: error.message });
  }
});

// 取得本月行程
router.get('/month', async (req, res) => {
  try {
    const events = await calendar.getMonthEvents(new Date());
    res.json({
      年月: new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' }),
      行程總數: events.length,
      行程列表: events.map(formatEvent)
    });
  } catch (error) {
    res.status(500).json({ error: '取得本月行程失敗', message: error.message });
  }
});

// 取得指定月份行程
router.get('/month/:year/:month', async (req, res) => {
  try {
    const { year, month } = req.params;
    const date = new Date(year, month - 1); // 月份從 0 開始
    
    if (isNaN(date.getTime())) {
      return res.status(400).json({ error: '日期格式無效' });
    }
    
    const events = await calendar.getMonthEvents(date);
    res.json({
      年月: date.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' }),
      行程總數: events.length,
      行程列表: events.map(formatEvent)
    });
  } catch (error) {
    res.status(500).json({ error: '取得月份行程失敗', message: error.message });
  }
});

// 新增行程
router.post('/event', async (req, res) => {
  try {
    const {
      summary,
      description,
      location,
      startTime,
      endTime,
      attendees,
      isAllDay
    } = req.body;

    const event = await calendar.createEvent({
      summary,
      description,
      location,
      startTime,
      endTime,
      attendees: attendees || [],
      isAllDay: isAllDay || false
    });

    res.json(event);
  } catch (error) {
    res.status(500).json({ error: '建立行程失敗', message: error.message });
  }
});

// 快速新增行程
router.post('/quick-event', async (req, res) => {
  try {
    const { text } = req.body;
    const event = await calendar.quickAddEvent(text);

    res.json({
      狀態: '成功',
      行程: formatEvent(event)
    });
  } catch (error) {
    res.status(500).json({ error: '快速建立行程失敗', message: error.message });
  }
});

module.exports = router; 