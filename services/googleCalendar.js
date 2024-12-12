const { google } = require('googleapis');
const path = require('path');
const fs = require('fs').promises;

class GoogleCalendarService {
  constructor() {
    // OAuth 2.0 憑證設定
    this.CREDENTIALS_PATH = path.join(__dirname, './config/oauth_credentials.json');
    this.TOKEN_PATH = path.join(__dirname, './config/oauth_token.json');
    this.SCOPES = [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events'
    ];
    
    this.auth = null;
    this.calendar = null;
    this.authPromiseResolve = null;
  }

  // 初始化 OAuth 客戶端
  async initialize() {
    try {
      const credentials = JSON.parse(await fs.readFile(this.CREDENTIALS_PATH));
      const { client_secret, client_id, redirect_uris } = credentials.web;
      
      this.auth = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirect_uris[0]
      );

      // 嘗試讀取已存在的 token
      try {
        const token = JSON.parse(await fs.readFile(this.TOKEN_PATH));
        this.auth.setCredentials(token);
      } catch (err) {
        // 如果沒有 token，需要重新授權
        await this.getNewToken();
      }

      this.calendar = google.calendar({ version: 'v3', auth: this.auth });
    } catch (error) {
      console.error('初始化失敗:', error);
      throw error;
    }
  }

  // 取得新的 OAuth token
  async getNewToken() {
    const authUrl = this.auth.generateAuthUrl({
      access_type: 'offline',
      scope: this.SCOPES,
    });

    // 建立等待授權碼的 Promise
    const authPromise = new Promise(resolve => {
      this.authPromiseResolve = resolve;
    });

    // 使用 dynamic import 開啟瀏覽器
    const open = await import('open');
    await open.default(authUrl);

    // 等待授權碼
    const code = await authPromise;
    
    try {
      const { tokens } = await this.auth.getToken(code);
      this.auth.setCredentials(tokens);
      await fs.writeFile(this.TOKEN_PATH, JSON.stringify(tokens));
      console.log('Token 已儲存至:', this.TOKEN_PATH);
    } catch (error) {
      console.error('取得 token 失敗:', error);
      throw error;
    }
  }

  // 處理 OAuth 回調
  handleOAuthCallback(code) {
    if (this.authPromiseResolve) {
      this.authPromiseResolve(code);
      this.authPromiseResolve = null;
    }
  }

  // 確保已初始化
  async ensureInitialized() {
    if (!this.calendar) {
      await this.initialize();
    }
  }

  // 取得某日行程
  async getDayEvents(date) {
    await this.ensureInitialized();
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.getEvents(startOfDay, endOfDay);
  }

  // 取得某週行程
  async getWeekEvents(date) {
    await this.ensureInitialized();
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return this.getEvents(startOfWeek, endOfWeek);
  }

  // 取得某月行程
  async getMonthEvents(date) {
    await this.ensureInitialized();
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

    return this.getEvents(startOfMonth, endOfMonth);
  }

  // 共用的取得事件方法
  async getEvents(timeMin, timeMax) {
    try {
      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      return response.data.items.map(event => ({
        id: event.id,
        summary: event.summary,
        description: event.description,
        start: event.start.dateTime || event.start.date,
        end: event.end.dateTime || event.end.date,
        location: event.location
      }));
    } catch (error) {
      console.error('取得行程時發生錯誤:', error);
      throw error;
    }
  }

  // 新增行程
  async createEvent({
    summary,           // 標題
    description = '',  // 描述
    location = '',     // 地點
    startTime,         // 開始時間
    endTime,          // 結束時間
    attendees = [],    // 與會者 email 陣列
    isAllDay = false   // 是否為全天行程
  }) {
    await this.ensureInitialized();

    try {
      const event = {
        summary,
        description,
        location,
        start: {},
        end: {},
        attendees: attendees.map(email => ({ email }))
      };
      console.log("Event Detail:", event)
      // 處理全天行程
      if (isAllDay) {
        // 使用 date 格式，例如 "2024-03-21"
        event.start.date = new Date(startTime).toISOString().split('T')[0];
        event.end.date = new Date(endTime).toISOString().split('T')[0];
      } else {
        // 使用 dateTime 格式，例如 "2024-03-21T09:00:00+08:00"
        event.start.dateTime = new Date(startTime).toISOString();
        event.end.dateTime = new Date(endTime).toISOString();
        event.start.timeZone = 'Asia/Taipei';
        event.end.timeZone = 'Asia/Taipei';
      }
      
      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
        sendUpdates: 'all'  // 發送邀請給與會者
      });

      return {
        id: response.data.id,
        summary: response.data.summary,
        description: response.data.description,
        start: response.data.start.dateTime || response.data.start.date,
        end: response.data.end.dateTime || response.data.end.date,
        location: response.data.location,
        htmlLink: response.data.htmlLink  // Google Calendar 連結
      };
    } catch (error) {
      console.error('建立行程失敗:', error);
      throw error;
    }
  }

  // 新增快速行程（簡化版）
  async quickAddEvent(text) {
    await this.ensureInitialized();
    
    try {
      const response = await this.calendar.events.quickAdd({
        calendarId: 'primary',
        text: text  // 例如: "Meeting with John tomorrow 3pm-4pm"
      });

      return {
        id: response.data.id,
        summary: response.data.summary,
        start: response.data.start.dateTime || response.data.start.date,
        end: response.data.end.dateTime || response.data.end.date,
        htmlLink: response.data.htmlLink
      };
    } catch (error) {
      console.error('快速建立行程失敗:', error);
      throw error;
    }
  }
}

// 導出單例
const calendarService = new GoogleCalendarService();
module.exports = calendarService;