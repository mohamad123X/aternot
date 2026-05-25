// bot_manager.js
const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers] });

client.on('messageCreate', async (message) => {
    // أمر تفعيل المهام
    if (message.content.startsWith('!تفعيل')) {
        const botName = message.content.split(' ')[1]; // مثلا: !تفعيل أحمد
        
        // كارلوس هنا يقوم بالتأكد من وجود البوت في السيرفر
        const member = message.guild.members.cache.find(m => m.user.username === botName);
        
        if (member && member.user.bot) {
            message.reply(`✅ تم رصد ${botName} في السيرفر، جاري إعطاؤه صلاحيات المهام...`);
            // هنا يمكنك إرسال إشارة للبوت ليبدأ عمله (عبر قاعدة بيانات أو Socket)
        } else {
            message.reply(`❌ لم أجد البوت ${botName} في السيرفر!`);
        }
    }
});

client.login(process.env.CARLOS_TOKEN);
