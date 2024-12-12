const fs = require("fs");
const sentencePrompt = fs.readFileSync('./subject_prompt.txt', 'utf-8');
const calendarPrompt = fs.readFileSync('./calendar_prompt.txt', 'utf-8');
const addCalendarPrompt = fs.readFileSync('./add_calendar_prompt.txt', 'utf-8');

async function reply(ollama, response, history) {
    try {
        console.log(response.message.content);
        if (response.message.content.includes("[REPLY]")) {
            return {message: response.message.content.replaceAll("[REPLY]", "")};
        } else if (response.message.content.includes("[SUBJECT]")) {
            history.push({
                role: 'system',
                content: sentencePrompt
            })
            history.push({
                role: 'user',
                content: response.message.content.replaceAll("[SUBJECT]", "")
            })
            const res = await ollama.chat({
                model: 'qwen2.5:32b',
                messages: history,
                keep_alive: -1,
                options: {
                temperature: 0.7,    // 控制輸出的隨機性 (0-1)
                top_p: 0.9,         // 控制輸出的多樣性
                top_k: 40,          // 限制每次選擇的候選詞數量
                repeat_penalty: 1.1, // 降低重複內容的可能性
                //seed: 42,           // 固定隨機種子以獲得可重複的結果
                num_predict: 100,    // 生成的最大token數量
                }
            });
            return await reply(ollama, res, history);
        } else if (response.message.content.includes("[CAL:")) {
            history.push({
                role: 'system',
                content: calendarPrompt
            })
            const calendar = require('./services/googleCalendar');
            if (response.message.content.includes("[CAL:TODAY]")) {
                const events = await calendar.getDayEvents(new Date());
                history.push({
                    role: 'system',
                    content: "Calendar: \n"+JSON.stringify({
                        date: new Date().toLocaleDateString('zh-TW'),
                        count: events.length,
                        calendars: events
                    })
                })
                history.push({
                    role: 'user',
                    content: response.message.content.replaceAll("[CAL:TODAY]", "")
                })
            }
            if (response.message.content.includes("[CAL:DAY:")) {
                const events = await calendar.getDayEvents(new Date(response.message.content.split("[CAL:DAY:")[1].split(']')[0]));
                console.log({
                    date: new Date(response.message.content.split("[CAL:DAY:")[1].split(']')[0]).toLocaleDateString('zh-TW'),
                    count: events.length,
                    calendars: events
                })
                history.push({
                    role: 'system',
                    content: "Calendar: \n"+JSON.stringify({
                        date: new Date().toLocaleDateString('zh-TW'),
                        count: events.length,
                        calendars: events
                    })
                })
                history.push({
                    role: 'user',
                    content: response.message.content.split("[CAL:DAY:")[1].split(']')[1]
                })
            }
            if (response.message.content.includes("[CAL:WEEK]")) {
                const events = await calendar.getWeekEvents(new Date());
                /*
                console.log({
                    date: new Date(),
                    count: events.length,
                    calendars: events
                })
                */
                const startOfWeek = new Date();
                startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
                history.push({
                    role: 'system',
                    content: "This Week Calendar: \n"+JSON.stringify({
                        startOfWeek: startOfWeek.toLocaleDateString('zh-TW'),
                        count: events.length,
                        calendars: events
                    })
                })
                history.push({
                    role: 'user',
                    content: response.message.content.replaceAll("[CAL:WEEK]", "")
                })
            }
            const seed = Math.floor(Math.random()*2147483647);
            console.log("Seed: ", seed);
            const res = await ollama.chat({
                model: 'qwen2.5:32b',
                messages: history,
                keep_alive: -1,
                options: {
                temperature: 0.7,    // 控制輸出的隨機性 (0-1)
                top_p: 0.9,         // 控制輸出的多樣性
                top_k: 40,          // 限制每次選擇的候選詞數量
                repeat_penalty: 1.1, // 降低重複內容的可能性
                seed: seed,           // 固定隨機種子以獲得可重複的結果
                num_predict: 100,    // 生成的最大token數量
                }
            });
            return await reply(ollama, res, history);
        } else if (response.message.content.includes("[ADD_CAL_")) {
            function replaceAddCal(text) {
                return text.replace(/\[ADD_CAL_\w+\]/g, ''); // 使用正則表達式取代
            }
            const calendar = require("./services/googleCalendar");
            const message = response.message.content;
            const summary = message.split("[ADD_CAL_")[1].split("_")[0];
            const startTime = message.split("[ADD_CAL_")[1].split("_")[1];
            const endTime = message.split("[ADD_CAL_")[1].split("_")[2];
            const isAllDay = (message.split("[ADD_CAL_")[1].split("_")[3] == "true");
            //console.log("Event Detail: ", {summary: summary, startTime: startTime, endTime: endTime, isAllDay, isAllDay})
            const event = await calendar.createEvent({summary, description: null, location:null, startTime, endTime, attendees:[], isAllDay});
            
            history.push({
                role: 'system',
                content: addCalendarPrompt
            })
            history.push({
                role: 'system',
                content: "Result: \n"+JSON.stringify(event)
            })
            console.log("Replace: ",replaceAddCal(response.message.content))
            history.push({
                role: 'user',
                content: replaceAddCal(response.message.content)
            })
            const seed = Math.floor(Math.random()*2147483647);
            console.log("Seed: ", seed);
            const res = await ollama.chat({
                model: 'qwen2.5:32b',
                messages: history,
                keep_alive: -1,
                options: {
                temperature: 0.7,    // 控制輸出的隨機性 (0-1)
                top_p: 0.9,         // 控制輸出的多樣性
                top_k: 40,          // 限制每次選擇的候選詞數量
                repeat_penalty: 1.1, // 降低重複內容的可能性
                seed: seed,           // 固定隨機種子以獲得可重複的結果
                num_predict: 100,    // 生成的最大token數量
                }
            });
            return await reply(ollama, res, history);
        }
    } catch(err) {
        console.log("Something error, rerendering...", err);
        history.pop();
        const res = await ollama.chat({
            model: 'qwen2.5:32b',
            messages: history,
            keep_alive: -1,
            options: {
            temperature: 0.7,    // 控制輸出的隨機性 (0-1)
            top_p: 0.9,         // 控制輸出的多樣性
            top_k: 40,          // 限制每次選擇的候選詞數量
            repeat_penalty: 1.1, // 降低重複內容的可能性
            //seed: 42,           // 固定隨機種子以獲得可重複的結果
            num_predict: 100,    // 生成的最大token數量
            }
        });
        return await reply(ollama, res, history);
    }
}

module.exports = {
    reply
}