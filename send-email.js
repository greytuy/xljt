const axios = require('axios');
const nodemailer = require('nodemailer');

// 从环境变量中获取配置
const aiConfigStr = process.env.AI_CONFIG;
const mailConfigStr = process.env.MAIL_CONFIG;
const recipientEmail = process.env.RECIPIENT_EMAIL;

// 校验 AI_CONFIG
if (!aiConfigStr) {
    console.error('错误：未设置 AI_CONFIG 环境变量。');
    process.exit(1);
}

let aiConfig;
try {
    aiConfig = JSON.parse(aiConfigStr);
} catch (error) {
    console.error('错误：解析 AI_CONFIG JSON 失败。', error);
    process.exit(1);
}

const { apiUrl, apiKey, model } = aiConfig;
if (!apiUrl || !apiKey || !model) {
    console.error('错误：AI_CONFIG 必须包含 "apiUrl", "apiKey", 和 "model" 三个键。');
    process.exit(1);
}

// 校验 MAIL_CONFIG
if (!mailConfigStr || !recipientEmail) {
    console.error('错误：一个或多个必要的环境变量 (MAIL_CONFIG, RECIPIENT_EMAIL) 未设置。');
    process.exit(1);
}

let mailConfig;
try {
    mailConfig = JSON.parse(mailConfigStr);
} catch (error) {
    console.error('错误：解析 MAIL_CONFIG JSON 失败。', error);
    process.exit(1);
}

/**
 * 从 DeepSeek AI 获取心灵鸡汤内容
 * @returns {Promise<string>} 返回一句励志名言
 */
async function getInspirationalQuote() {
    try {
        const response = await axios.post(
            apiUrl,
            {
                model: model,
                messages: [
                    { role: 'system', content: 'You are a helpful assistant.' },
                    { role: 'user', content: '请生成一段简短的、激励人心的心灵鸡汤文字，用于每日邮件发送。' }
                ],
                max_tokens: 100,
                temperature: 1,
                stream: false
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.data && response.data.choices && response.data.choices.length > 0) {
            return response.data.choices[0].message.content.trim();
        } else {
            throw new Error('从 DeepSeek API 返回的响应格式无效。');
        }
    } catch (error) {
        console.error('错误：从 DeepSeek API 获取内容失败。', error.response ? error.response.data : error.message);
        // 在 API 调用失败时返回一句备用名言
        return '即使翅膀断了，心也要飞翔。';
    }
}

/**
 * 发送邮件
 * @param {string} content 邮件正文内容
 */
async function sendEmail(content) {
    const transporter = nodemailer.createTransport(mailConfig);

    // 从 mailConfig 中确定发件人信息，如果未提供 sender，则回退到 auth.user
    const fromEmail = mailConfig.sender?.email || mailConfig.auth.user;
    const fromName = mailConfig.sender?.name || fromEmail.split('@')[0];

    const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: recipientEmail,
        subject: '今日份的心灵鸡汤请查收 ✨',
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                <h2>你好,</h2>
                <p>希望你拥有美好的一天！这里有一句今日份的心灵鸡汤送给你：</p>
                <blockquote style="font-size: 1.2em; border-left: 4px solid #ccc; padding-left: 1em; margin: 1em 0;">
                    <strong>${content}</strong>
                </blockquote>
                <p>祝好,<br>你的贴心小助手</p>
            </div>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('邮件发送成功:', info.messageId);
    } catch (error) {
        console.error('错误：发送邮件失败。', error);
        process.exit(1);
    }
}

async function main() {
    console.log('开始执行任务：获取内容并发送邮件...');
    const quote = await getInspirationalQuote();
    console.log(`获取到的内容: "${quote}"`);
    await sendEmail(quote);
    console.log('任务完成。');
}

main();