// 测试DEBUG功能
console.log('=== 测试DEBUG功能 ===\n');

// 测试1: DEBUG=false (默认)
console.log('测试1: DEBUG=false (默认模式)');
process.env.DEBUG = 'false';
process.env.AI_CONFIG = '{"apiUrl": "test", "apiKey": "test", "model": "test"}';
process.env.MAIL_CONFIG = '{"host": "test", "port": 587, "auth": {"user": "test@example.com", "pass": "test"}}';
process.env.RECIPIENT_EMAIL = 'test@example.com';

// 模拟敏感信息
const testEmail = '8da08301-8e1f-3afc-2b6e-fa9da400f52a@mail.haobing.cf';
const testMessageId = '<test-message-id@example.com>';

// 测试safeLog函数
const debugMode = process.env.DEBUG === 'true';

function safeLog(message, ...args) {
    if (debugMode) {
        console.log(message, ...args);
    } else {
        // 在非debug模式下，隐藏敏感信息
        const safeMessage = message.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[邮箱已隐藏]');
        const safeArgs = args.map(arg => {
            if (typeof arg === 'string') {
                return arg.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[邮箱已隐藏]');
            }
            return arg;
        });
        console.log(safeMessage, ...safeArgs);
    }
}

function progressLog(message, ...args) {
    console.log(message, ...args);
}

console.log(`DEBUG模式: ${debugMode}`);
safeLog(`测试敏感邮箱信息: ${testEmail}`);
progressLog(`邮件发送成功! 消息ID: ${debugMode ? testMessageId : '[消息ID已隐藏]'}`);
console.log('');

// 测试2: DEBUG=true
console.log('测试2: DEBUG=true (调试模式)');
process.env.DEBUG = 'true';
const debugMode2 = process.env.DEBUG === 'true';

console.log(`DEBUG模式: ${debugMode2}`);
safeLog(`测试敏感邮箱信息: ${testEmail}`);
progressLog(`邮件发送成功! 消息ID: ${debugMode2 ? testMessageId : '[消息ID已隐藏]'}`);

console.log('\n=== 测试完成 ===');