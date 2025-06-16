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
 * 从AI响应中提取实际内容（处理thinking标签）
 * @param {string} rawContent AI返回的原始内容
 * @returns {string} 提取后的实际内容
 */
function extractActualContent(rawContent) {
    if (!rawContent || typeof rawContent !== 'string') {
        return '';
    }
    
    let content = rawContent.trim();
    
    // 方法1: 如果包含</think>标签，提取标签后的内容
    const thinkEndMatch = content.match(/<\/think>\s*([\s\S]*?)$/i);
    if (thinkEndMatch && thinkEndMatch[1]) {
        content = thinkEndMatch[1].trim();
        console.log('检测到</think>标签，提取标签后内容');
    }
    
    // 方法2: 移除所有thinking相关标签及其内容
    content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    content = content.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();
    content = content.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();
    
    // 清理可能残留的标签
    content = content.replace(/<\/?think>/gi, '').trim();
    content = content.replace(/<\/?thinking>/gi, '').trim();
    content = content.replace(/<\/?thought>/gi, '').trim();
    
    return content;
}

/**
 * 验证内容是否完整有效
 * @param {string} content 要验证的内容
 * @returns {boolean} 内容是否有效
 */
function isValidContent(content) {
    if (!content || typeof content !== 'string') {
        return false;
    }
    
    const trimmedContent = content.trim();
    
    // 检查是否为空或过短
    if (trimmedContent.length < 5) {
        return false;
    }
    
    // 检查是否仍包含未处理的思考标签
    const remainingTags = ['<think>', '<thinking>', '<thought>'];
    for (const tag of remainingTags) {
        if (trimmedContent.toLowerCase().includes(tag)) {
            return false;
        }
    }
    
    return true;
}

/**
 * 从 DeepSeek AI 获取心灵鸡汤内容
 * @returns {Promise<string>} 返回一句励志名言
 */
async function getInspirationalQuote() {
    const maxRetries = 3;
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`尝试获取AI内容 (第${attempt}次)...`);
            
            const response = await axios.post(
                apiUrl,
                {
                    model: model,
                    messages: [
                        {
                            role: 'system',
                            content: '你是一个专业的励志内容创作者。请生成简短、积极、励志的HTML格式内容，用于邮件发送。可以包含思考过程，但最终请提供完整的HTML格式励志内容。'
                        },
                        {
                            role: 'user',
                            content: '请生成一段励志的HTML内容，用于每日邮件发送。要求：1）可以包含你的思考过程 2）最终提供完整的HTML格式内容 3）内容积极正面，包含励志语句和简短说明 4）使用适当的HTML标签美化格式'
                        }
                    ],
                    max_tokens: 300,
                    temperature: 0.8,
                    stream: false
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000  // 30秒超时
                }
            );

            if (response.data && response.data.choices && response.data.choices.length > 0) {
                const rawContent = response.data.choices[0].message.content.trim();
                console.log(`AI返回原始内容: "${rawContent.substring(0, 200)}..."`);
                
                // 提取实际内容（处理thinking标签）
                const extractedContent = extractActualContent(rawContent);
                console.log(`提取后的内容: "${extractedContent.substring(0, 200)}..."`);
                
                // 验证内容是否完整有效
                if (isValidContent(extractedContent)) {
                    console.log(`内容验证通过，使用AI生成的内容`);
                    return extractedContent;
                } else {
                    console.log(`内容验证失败，内容可能不完整`);
                    if (attempt < maxRetries) {
                        console.log(`将进行第${attempt + 1}次重试...`);
                        continue;
                    }
                }
            } else {
                throw new Error('从 DeepSeek API 返回的响应格式无效。');
            }
        } catch (error) {
            lastError = error;
            // 更安全的错误信息提取
            const errorMessage = error.response?.data || error.message || '未知错误';
            console.error(`第${attempt}次尝试失败:`, errorMessage);
            
            if (attempt < maxRetries) {
                console.log(`将进行第${attempt + 1}次重试...`);
                // 等待1秒后重试，使用更安全的延迟方式
                await new Promise((resolve) => {
                    const timeoutId = setTimeout(() => {
                        resolve();
                    }, 1000);
                    
                    // 确保在进程退出时清理定时器
                    process.once('SIGINT', () => {
                        clearTimeout(timeoutId);
                        resolve();
                    });
                });
            }
        }
    }
    
    console.error('所有重试都失败了，使用备用HTML内容');
    console.error('最后一次错误:', lastError?.response ? lastError.response.data : lastError?.message);
    
    // 在所有重试都失败时返回备用HTML内容
    return `
        <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 10px; margin: 10px 0;">
            <h3 style="margin: 0 0 15px 0; font-size: 1.2em;">✨ 今日励志 ✨</h3>
            <p style="font-size: 1.1em; font-weight: bold; margin: 0 0 10px 0;">
                "每一个不曾起舞的日子，都是对生命的辜负。"
            </p>
            <p style="font-size: 0.9em; opacity: 0.9; margin: 0;">
                愿你今天也能找到属于自己的舞蹈，在平凡中创造不平凡。
            </p>
        </div>
    `;
}

/**
 * 发送邮件
 * @param {string} content 邮件正文内容
 */
async function sendEmail(content) {
    // 输入验证
    if (!content || typeof content !== 'string') {
        throw new Error('邮件内容不能为空且必须是字符串类型');
    }

    const transporter = nodemailer.createTransport(mailConfig);

    // 从 mailConfig 中确定发件人信息，如果未提供 sender，则回退到 auth.user
    const fromEmail = mailConfig.sender?.email || mailConfig.auth?.user;
    if (!fromEmail) {
        throw new Error('无法确定发件人邮箱地址，请检查邮件配置');
    }
    
    const fromName = mailConfig.sender?.name || fromEmail.split('@')[0];

    // 检查内容是否已经是HTML格式
    const isHtmlContent = content.trim().startsWith('<') && content.includes('>');
    
    let emailHtml;
    if (isHtmlContent) {
        // 如果是HTML内容，直接使用并添加简单的包装
        emailHtml = `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333; text-align: center;">你好！</h2>
                <p style="color: #666; text-align: center;">希望你拥有美好的一天！这里有今日份的心灵鸡汤送给你：</p>
                ${content}
                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #888; font-size: 0.9em;">
                    <p>祝好,<br>你的贴心小助手 💝</p>
                </div>
            </div>
        `;
    } else {
        // 如果是纯文本，使用原来的模板
        emailHtml = `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                <h2>你好,</h2>
                <p>希望你拥有美好的一天！这里有一句今日份的心灵鸡汤送给你：</p>
                <blockquote style="font-size: 1.2em; border-left: 4px solid #ccc; padding-left: 1em; margin: 1em 0;">
                    <strong>${content}</strong>
                </blockquote>
                <p>祝好,<br>你的贴心小助手</p>
            </div>
        `;
    }

    const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: recipientEmail,
        subject: '今日份的心灵鸡汤请查收 ✨',
        html: emailHtml
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
    try {
        console.log('开始执行任务：获取内容并发送邮件...');
        const quote = await getInspirationalQuote();
        console.log(`获取到的内容: "${quote}"`);
        await sendEmail(quote);
        console.log('任务完成。');
    } catch (error) {
        console.error('主程序执行失败:', error);
        process.exit(1);
    }
}

// 处理未捕获的Promise rejection
process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的Promise rejection:', reason);
    console.error('Promise:', promise);
    process.exit(1);
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error);
    process.exit(1);
});

// 优雅退出处理
process.on('SIGINT', () => {
    console.log('\n收到SIGINT信号，正在优雅退出...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n收到SIGTERM信号，正在优雅退出...');
    process.exit(0);
});

main();