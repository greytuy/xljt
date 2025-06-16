const axios = require('axios');
const nodemailer = require('nodemailer');

// 从环境变量中获取配置
const aiConfigStr = process.env.AI_CONFIG;
const mailConfigStr = process.env.MAIL_CONFIG;
const recipientEmail = process.env.RECIPIENT_EMAIL;
const recipientEmails = process.env.RECIPIENT_EMAILS;

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

// 校验 MAIL_CONFIG 和收件人配置
if (!mailConfigStr) {
    console.error('错误：MAIL_CONFIG 环境变量未设置。');
    process.exit(1);
}

if (!recipientEmails && !recipientEmail) {
    console.error('错误：必须设置 RECIPIENT_EMAILS 或 RECIPIENT_EMAIL 环境变量之一。');
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
 * 验证邮箱地址格式
 * @param {string} email 邮箱地址
 * @returns {boolean} 邮箱地址是否有效
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * 处理和验证收件人邮箱地址
 * @returns {string|string[]} 返回单个邮箱地址或邮箱地址数组
 */
function processRecipients() {
    let recipients;
    
    // 优先使用 RECIPIENT_EMAILS，如果没有则使用 RECIPIENT_EMAIL
    if (recipientEmails) {
        // 处理多个收件人
        recipients = recipientEmails
            .split(',')
            .map(email => email.trim())
            .filter(email => email.length > 0);
        
        // 验证所有邮箱地址
        const invalidEmails = recipients.filter(email => !isValidEmail(email));
        if (invalidEmails.length > 0) {
            console.error('错误：以下邮箱地址格式无效:', invalidEmails.join(', '));
            process.exit(1);
        }
        
        console.log(`检测到 ${recipients.length} 个收件人:`, recipients.join(', '));
        return recipients;
    } else {
        // 处理单个收件人
        recipients = recipientEmail.trim();
        
        if (!isValidEmail(recipients)) {
            console.error('错误：邮箱地址格式无效:', recipients);
            process.exit(1);
        }
        
        console.log('检测到 1 个收件人:', recipients);
        return recipients;
    }
}

/**
 * 清理HTML内容，移除代码块标记和其他无关内容
 * @param {string} htmlContent 原始HTML内容
 * @returns {string} 清理后的HTML内容
 */
function cleanHtmlContent(htmlContent) {
    if (!htmlContent || typeof htmlContent !== 'string') {
        return '';
    }
    
    let content = htmlContent.trim();
    
    // 移除代码块标记
    content = content.replace(/^```html\s*/i, '');
    content = content.replace(/```\s*$/, '');
    content = content.replace(/^```\s*/m, '');
    
    // 移除可能的markdown标记
    content = content.replace(/^html\s*/i, '');
    
    return content.trim();
}

/**
 * 从AI响应中提取实际内容（处理thinking标签和HTML代码块）
 * @param {string} rawContent AI返回的原始内容
 * @returns {string} 提取后的实际内容
 */
function extractActualContent(rawContent) {
    if (!rawContent || typeof rawContent !== 'string') {
        return '';
    }
    
    let content = rawContent.trim();
    
    // 方法1：提取```html ```代码块中的内容（完整匹配）
    const htmlCodeBlockMatch = content.match(/```html\s*\n?([\s\S]*?)\n?\s*```/i);
    if (htmlCodeBlockMatch && htmlCodeBlockMatch[1]) {
        const htmlContent = htmlCodeBlockMatch[1].trim();
        console.log('检测到完整HTML代码块，提取代码块内容');
        return cleanHtmlContent(htmlContent);
    }
    
    // 方法2：如果没有完整的代码块，但有```html开头，提取后面的内容
    const htmlStartMatch = content.match(/```html\s*\n?([\s\S]*?)$/i);
    if (htmlStartMatch && htmlStartMatch[1]) {
        let htmlContent = htmlStartMatch[1].trim();
        console.log('检测到HTML代码块开始标记，提取后续内容');
        return cleanHtmlContent(htmlContent);
    }
    
    // 方法3：查找任何```html标记并提取
    if (content.includes('```html')) {
        const parts = content.split('```html');
        if (parts.length > 1) {
            let htmlPart = parts[1];
            // 移除结尾的```如果存在
            htmlPart = htmlPart.replace(/```[\s\S]*$/, '').trim();
            console.log('通过分割```html标记提取内容');
            return cleanHtmlContent(htmlPart);
        }
    }
    
    // 备用方法1: 如果包含</think>标签，提取标签后的内容
    const thinkEndMatch = content.match(/<\/think>\s*([\s\S]*?)$/i);
    if (thinkEndMatch && thinkEndMatch[1]) {
        content = thinkEndMatch[1].trim();
        console.log('检测到</think>标签，提取标签后内容');
    }
    
    // 备用方法2: 移除所有thinking相关标签及其内容
    content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    content = content.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();
    content = content.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();
    
    // 清理可能残留的标签
    content = content.replace(/<\/?think>/gi, '').trim();
    content = content.replace(/<\/?thinking>/gi, '').trim();
    content = content.replace(/<\/?thought>/gi, '').trim();
    
    // 备用方法3: 如果内容以思考过程开头，尝试提取HTML部分
    if (content.includes('思考过程：') || content.includes('思考：')) {
        // 查找第一个HTML标签的位置
        const htmlMatch = content.match(/<(div|p|h[1-6]|span)[^>]*>/i);
        if (htmlMatch) {
            const htmlStartIndex = content.indexOf(htmlMatch[0]);
            content = content.substring(htmlStartIndex).trim();
            console.log('检测到思考过程文字，提取HTML部分');
        }
    }
    
    // 备用方法4: 移除常见的思考过程文字段落
    const thinkingPatterns = [
        /^思考过程：[\s\S]*?(?=<[a-zA-Z])/,
        /^分析：[\s\S]*?(?=<[a-zA-Z])/,
        /^让我[\s\S]*?(?=<[a-zA-Z])/,
        /^我需要[\s\S]*?(?=<[a-zA-Z])/,
        /^我应该[\s\S]*?(?=<[a-zA-Z])/
    ];
    
    for (const pattern of thinkingPatterns) {
        content = content.replace(pattern, '').trim();
    }
    
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
 * 验证内容是否为有效的HTML格式
 * @param {string} content 要验证的内容
 * @returns {boolean} 内容是否为有效的HTML
 */
function isValidHTMLContent(content) {
    if (!content || typeof content !== 'string') {
        return false;
    }
    
    const trimmedContent = content.trim();
    
    // 检查是否为空或过短
    if (trimmedContent.length < 10) {
        return false;
    }
    
    // 检查是否仍包含未处理的思考标签（但不检查思考过程文字，因为已经通过代码块提取）
    const thinkingTags = ['<think>', '<thinking>', '<thought>'];
    
    const lowerContent = trimmedContent.toLowerCase();
    for (const tag of thinkingTags) {
        if (lowerContent.includes(tag.toLowerCase())) {
            return false;
        }
    }
    
    // 检查是否包含HTML标签
    const hasHtmlTags = /<[^>]+>/.test(trimmedContent);
    if (!hasHtmlTags) {
        return false;
    }
    
    // 检查是否包含基本的HTML结构元素
    const hasStructuralElements = /(<div|<p|<h[1-6]|<span)/i.test(trimmedContent);
    if (!hasStructuralElements) {
        return false;
    }
    
    // 检查是否看起来像励志内容（包含积极词汇或常见励志表达）
    const positiveWords = [
        '励志', '积极', '正能量', '美好', '希望', '成功', '努力', '坚持', '梦想', '未来',
        '加油', '奋斗', '进步', '成长', '勇气', '信心', '目标', '理想', '拼搏', '向前',
        '每一天', '新的', '开始', '机会', '挑战', '克服', '相信', '自己', '能力', '实现'
    ];
    const hasPositiveContent = positiveWords.some(word => trimmedContent.includes(word));
    
    // 如果没有找到积极词汇，但内容看起来是完整的HTML结构，也认为是有效的
    const hasCompleteStructure = trimmedContent.includes('<div') && trimmedContent.includes('</div>');
    
    return hasPositiveContent || hasCompleteStructure;
}

/**
 * 从 DeepSeek AI 获取励志HTML内容
 * @returns {Promise<string>} 返回格式化的HTML励志内容
 */
async function getInspirationalQuote() {
    // const maxRetries = 3;
    const maxRetries = 10; //修改最大重试次数为5次

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
                            content: '你是一个专业的励志内容创作者。你可以在<think></think>标签中进行思考，然后在```html ```代码块中输出最终的HTML代码。'
                        },
                        {
                            role: 'user',
                            content: `请生成一段励志的HTML内容，用于每日邮件发送。

你可以在<think></think>标签中思考设计思路，然后在\`\`\`html代码块中输出最终的HTML代码。

要求：
1. HTML内容应包含：
   - 一个醒目的标题（使用h2或h3标签）
   - 一句核心励志语句（使用strong或em标签强调）
   - 一段简短的解释或鼓励话语（100-200字）
   - 适当的CSS内联样式美化
2. 使用温暖的颜色搭配和合理的布局
3. 确保在邮件客户端中显示良好

**重要格式要求：**
- 思考过程放在<think></think>标签中
- HTML代码放在\`\`\`html代码块中
- 代码块后必须有\`\`\`结尾

格式示例：
<think>
设计思路：使用温暖的渐变背景...
</think>

\`\`\`html
<div style="background: linear-gradient(135deg, #FFA73F 0%, #FFD146 100%); color: white; padding: 20px; border-radius: 10px; text-align: center;">
    <h3 style="margin: 0 0 15px 0;">今日励志</h3>
    <p style="font-size: 1.2em; font-weight: bold; margin: 0 0 15px 0;"><strong>励志语句</strong></p>
    <p style="opacity: 0.9; margin: 0;">解释文字内容...</p>
</div>
\`\`\``
                        }
                    ],
                    max_tokens: 500,
                    temperature: 1.0,
                    // stream: false
                    stream: true // 启用流式响应
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
                
                // 等待3分钟让AI完全生成内容
                console.log('等待3分钟让AI完全生成内容...');
                await new Promise((resolve) => {
                    const timeoutId = setTimeout(() => {
                        resolve();
                    }, 180000); // 3分钟 = 180秒 = 180000毫秒
                    
                    // 确保在进程退出时清理定时器
                    process.once('SIGINT', () => {
                        clearTimeout(timeoutId);
                        resolve();
                    });
                });
                console.log('等待完成，开始解析AI生成的内容...');
                
                // 提取实际内容（处理thinking标签）
                const extractedContent = extractActualContent(rawContent);
                console.log(`提取后的内容: "${extractedContent.substring(0, 200)}..."`);
                
                // 验证内容是否为有效的HTML格式
                if (isValidHTMLContent(extractedContent)) {
                    console.log(`内容验证通过，使用AI生成的内容`);
                    return extractedContent;
                } else {
                    console.log(`内容验证失败，不是有效的HTML格式或仍包含思考过程`);
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
    const fallbackQuotes = [
        {
            quote: "每一个不曾起舞的日子，都是对生命的辜负。",
            explanation: "愿你今天也能找到属于自己的舞蹈，在平凡中创造不平凡。生活不仅仅是生存，更是要活出精彩。"
        },
        {
            quote: "成功不是终点，失败不是末日，继续前进的勇气才最可贵。",
            explanation: "每一次挫折都是成长的机会，每一次努力都在为未来的成功积蓄力量。保持勇气，继续前行。"
        },
        {
            quote: "今天的努力，是为了明天更好的自己。",
            explanation: "每一份付出都不会白费，每一次坚持都在塑造更强大的你。相信过程，享受成长。"
        }
    ];
    
    const randomQuote = fallbackQuotes[Math.floor(Math.random() * fallbackQuotes.length)];
    
    return `
        <div style="font-family: 'Microsoft YaHei', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 15px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                <h2 style="margin: 0 0 20px 0; font-size: 1.5em; font-weight: bold;">✨ 今日励志 ✨</h2>
                <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 10px; margin: 15px 0;">
                    <p style="font-size: 1.3em; font-weight: bold; margin: 0 0 15px 0; line-height: 1.4;">
                        "${randomQuote.quote}"
                    </p>
                </div>
                <p style="font-size: 1em; opacity: 0.9; margin: 0; line-height: 1.6;">
                    ${randomQuote.explanation}
                </p>
            </div>
            <div style="text-align: center; margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 10px; border-left: 4px solid #667eea;">
                <p style="margin: 0; color: #666; font-size: 0.9em;">
                    💡 <strong>温馨提示：</strong>由于AI服务暂时不可用，这是为您准备的备用励志内容。
                </p>
            </div>
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

    // 处理收件人
    const recipients = processRecipients();
    const recipientCount = Array.isArray(recipients) ? recipients.length : 1;
    const recipientList = Array.isArray(recipients) ? recipients.join(', ') : recipients;

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
        to: recipients,
        subject: '今日份的心灵鸡汤请查收 ✨',
        html: emailHtml
    };

    try {
        console.log(`正在发送邮件给 ${recipientCount} 个收件人...`);
        const info = await transporter.sendMail(mailOptions);
        console.log(`邮件发送成功! 消息ID: ${info.messageId}`);
        console.log(`收件人: ${recipientList}`);
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