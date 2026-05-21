const mineflayer = require('mineflayer');

// إعدادات البوت - قم بتغييرها بما يناسب سيرفرك
const bot = mineflayer.createBot({
  host: 'dynamic-6.magmanode.com:25993', // ضع IP سيرفرك هنا
  port: 25993,            // ضع البورت هنا
  username: 'hamzagog', // اسم البوت
  version: '1.26.1'       // تأكد من توافق الإصدار
});

bot.on('spawn', () => {
  console.log('البوت دخل السيرفر بنجاح!');
  bot.chat('أنا هنا للحفاظ على نشاط السيرفر.');
});

// ميزة إعادة الاتصال تلقائياً إذا فصل
bot.on('end', () => {
  console.log('فصل الاتصال، سأحاول الدخول مجدداً بعد 5 ثوانٍ...');
  setTimeout(() => {
    // الكود سيعيد تشغيل نفسه تلقائياً عبر الاستضافة
    process.exit(1); 
  }, 5000);
});

bot.on('error', (err) => console.log('حدث خطأ:', err));
