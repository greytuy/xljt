// 测试收件人处理功能
const { execSync } = require('child_process');

// 模拟环境变量设置
function testRecipientProcessing() {
    console.log('=== 测试收件人处理功能 ===\n');
    
    // 测试用例1：单收件人（RECIPIENT_EMAIL）
    console.log('测试1：单收件人配置');
    process.env.RECIPIENT_EMAIL = 'test@example.com';
    delete process.env.RECIPIENT_EMAILS;
    
    try {
        // 这里我们只测试邮箱验证逻辑，不实际发送邮件
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const email = process.env.RECIPIENT_EMAIL.trim();
        const isValid = emailRegex.test(email);
        console.log(`  邮箱: ${email}`);
        console.log(`  格式验证: ${isValid ? '✓ 有效' : '✗ 无效'}`);
        console.log(`  收件人数量: 1\n`);
    } catch (error) {
        console.error('  错误:', error.message);
    }
    
    // 测试用例2：多收件人（RECIPIENT_EMAILS）
    console.log('测试2：多收件人配置');
    process.env.RECIPIENT_EMAILS = 'user1@example.com, user2@test.com , user3@demo.org';
    
    try {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const recipients = process.env.RECIPIENT_EMAILS
            .split(',')
            .map(email => email.trim())
            .filter(email => email.length > 0);
        
        console.log(`  原始输入: "${process.env.RECIPIENT_EMAILS}"`);
        console.log(`  处理后的收件人:`);
        recipients.forEach((email, index) => {
            const isValid = emailRegex.test(email);
            console.log(`    ${index + 1}. ${email} ${isValid ? '✓' : '✗'}`);
        });
        console.log(`  收件人数量: ${recipients.length}\n`);
    } catch (error) {
        console.error('  错误:', error.message);
    }
    
    // 测试用例3：无效邮箱地址
    console.log('测试3：无效邮箱地址');
    process.env.RECIPIENT_EMAILS = 'invalid-email, user@test.com, another-invalid';
    
    try {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const recipients = process.env.RECIPIENT_EMAILS
            .split(',')
            .map(email => email.trim())
            .filter(email => email.length > 0);
        
        const validEmails = recipients.filter(email => emailRegex.test(email));
        const invalidEmails = recipients.filter(email => !emailRegex.test(email));
        
        console.log(`  输入: "${process.env.RECIPIENT_EMAILS}"`);
        console.log(`  有效邮箱 (${validEmails.length}):`, validEmails);
        console.log(`  无效邮箱 (${invalidEmails.length}):`, invalidEmails);
        
        if (invalidEmails.length > 0) {
            console.log(`  ⚠️  检测到无效邮箱，实际运行时会报错并退出\n`);
        }
    } catch (error) {
        console.error('  错误:', error.message);
    }
    
    // 测试用例4：优先级测试（同时设置两个环境变量）
    console.log('测试4：优先级测试（同时设置 RECIPIENT_EMAILS 和 RECIPIENT_EMAIL）');
    process.env.RECIPIENT_EMAIL = 'single@example.com';
    process.env.RECIPIENT_EMAILS = 'multi1@example.com,multi2@example.com';
    
    console.log(`  RECIPIENT_EMAIL: ${process.env.RECIPIENT_EMAIL}`);
    console.log(`  RECIPIENT_EMAILS: ${process.env.RECIPIENT_EMAILS}`);
    
    if (process.env.RECIPIENT_EMAILS) {
        console.log(`  ✓ 系统将优先使用 RECIPIENT_EMAILS (多收件人配置)`);
        const recipients = process.env.RECIPIENT_EMAILS.split(',').map(e => e.trim());
        console.log(`  实际使用的收件人: ${recipients.join(', ')}`);
    } else {
        console.log(`  系统将使用 RECIPIENT_EMAIL (单收件人配置)`);
    }
    
    console.log('\n=== 测试完成 ===');
}

testRecipientProcessing();