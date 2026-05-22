const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    REST, 
    Routes,
    MessageFlags,
    ChannelType,
    PermissionsBitField,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const mineflayer = require('mineflayer');
const fs = require('fs');
const path = require('path');

// إعداد قاعدة بيانات بسيطة لحفظ إعدادات السيرفرات
const dbPath = path.join(__dirname, 'database.json');
function loadDB() {
    if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify({}));
    return JSON.parse(fs.readFileSync(dbPath));
}
function saveDB(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 4));
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// متغير لحفظ البوتات الشغالة حالياً بناءً على آيدي السيرفر
const activeMinecraftBots = new Map();
const TOKEN = process.env.DISCORD_TOKEN;

// 1. تسجيل أوامر السلاش عند تشغيل البوت
client.on('clientReady', async () => {
    console.log(`🔥 تم تشغيل بوت الديسكورد بنجاح باسم: ${client.user.tag}`);
    
    const commands = [
        {
            name: 'setup',
            description: 'تثبيت نظام بوت ماين كرافت في سيرفرك وإنشاء القنوات',
            options: [
                { type: 3, name: 'bot_name', description: 'اسم بوت ماين كرافت (اللاعب)', required: true },
                { type: 8, name: 'allowed_role', description: 'الرتبة المسموح لها برؤية القنوات', required: true },
                { type: 3, name: 'logs_channel', description: 'اسم قناة السجلات (الدخول/الخروج/الشات)', required: true },
                { type: 3, name: 'settings_channel', description: 'اسم قناة الإعدادات', required: true },
                { type: 3, name: 'control_channel', description: 'اسم قناة التحكم (تشغيل/إطفاء)', required: true },
                { type: 3, name: 'server_ip', description: 'عنوان السيرفر (IP)', required: true },
                { type: 3, name: 'server_type', description: 'نوع الحساب', required: true, choices: [{name: 'مكرك (Offline)', value: 'offline'}, {name: 'أصلي (Premium)', value: 'online'}] },
                { type: 4, name: 'server_port', description: 'البورت (اختياري، الافتراضي 25565)', required: false }
            ]
        }
    ];

    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ تم تسجيل أمر التثبيت /setup بنجاح!');
    } catch (error) {
        console.error('❌ خطأ في تسجيل الأوامر:', error);
    }
});

// 2. معالجة التفاعلات (أوامر، أزرار، قوائم)
client.on('interactionCreate', async interaction => {
    
    // ==========================================
    // أ- التعامل مع أمر التثبيت /setup
    // ==========================================
    if (interaction.isChatInputCommand() && interaction.commandName === 'setup') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: '❌ يجب أن تكون مسؤولاً (Administrator) لاستخدام هذا الأمر.', flags: [MessageFlags.Ephemeral] });
        }

        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        const botName = interaction.options.getString('bot_name');
        const allowedRole = interaction.options.getRole('allowed_role');
        const logsChName = interaction.options.getString('logs_channel');
        const settingsChName = interaction.options.getString('settings_channel');
        const controlChName = interaction.options.getString('control_channel');
        const serverIp = interaction.options.getString('server_ip');
        const serverType = interaction.options.getString('server_type');
        const serverPort = interaction.options.getInteger('server_port') || 25565;

        try {
            // إنشاء Category بصلاحيات مخصصة (مخفية عن الجميع وظاهرة للرتبة المختارة)
            const category = await interaction.guild.channels.create({
                name: '⚙️ نظام إدارة ماين كرافت',
                type: ChannelType.GuildCategory,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }, // منع الجميع
                    { id: allowedRole.id, allow: [PermissionsBitField.Flags.ViewChannel] } // السماح للرتبة
                ]
            });

            // إنشاء القنوات الثلاث داخل الكاتيجوري
            const logsCh = await interaction.guild.channels.create({ name: logsChName, type: ChannelType.GuildText, parent: category.id });
            const settingsCh = await interaction.guild.channels.create({ name: settingsChName, type: ChannelType.GuildText, parent: category.id });
            const controlCh = await interaction.guild.channels.create({ name: controlChName, type: ChannelType.GuildText, parent: category.id });

            // حفظ الإعدادات في قاعدة البيانات (ملف JSON)
            const db = loadDB();
            db[interaction.guild.id] = {
                botName, serverIp, serverPort, serverType,
                logsChannelId: logsCh.id,
                settingsChannelId: settingsCh.id,
                controlChannelId: controlCh.id
            };
            saveDB(db);

            // إعداد رسالة التحكم (تشغيل / إطفاء)
            const controlEmbed = new EmbedBuilder()
                .setTitle('🎮 لوحة تحكم بوت ماين كرافت')
                .setDescription('استخدم الأزرار أدناه لتشغيل أو إيقاف البوت.')
                .setColor('Blue');
            const controlRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_start_bot').setLabel('🟢 تشغيل البوت').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('btn_stop_bot').setLabel('🔴 إطفاء البوت').setStyle(ButtonStyle.Danger)
            );
            await controlCh.send({ embeds: [controlEmbed], components: [controlRow] });

            // إعداد رسالة الإعدادات (معلومات السيرفر + زر تعديل)
            sendSettingsMessage(settingsCh, db[interaction.guild.id]);

            await interaction.followUp({ content: '✅ تم تثبيت النظام وإنشاء القنوات بنجاح!' });
        } catch (err) {
            console.error(err);
            await interaction.followUp({ content: '❌ حدث خطأ أثناء إنشاء القنوات. تأكد من إعطاء البوت صلاحية Administrator.' });
        }
    }

    // ==========================================
    // ب- التعامل مع الأزرار (تشغيل / إطفاء / تعديل)
    // ==========================================
    if (interaction.isButton()) {
        const db = loadDB();
        const config = db[interaction.guild.id];
        if (!config) return interaction.reply({ content: '❌ لم يتم تثبيت البوت في هذا السيرفر. استخدم `/setup` أولاً.', flags: [MessageFlags.Ephemeral] });

        // زر التشغيل: إظهار قائمة اختيار الإصدار
        if (interaction.customId === 'btn_start_bot') {
            if (activeMinecraftBots.has(interaction.guild.id)) {
                return interaction.reply({ content: '⚠️ البوت يعمل بالفعل!', flags: [MessageFlags.Ephemeral] });
            }

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_version_start')
                .setPlaceholder('اختر إصدار السيرفر للبدء...')
                .addOptions(
                    new StringSelectMenuOptionBuilder().setLabel('🔍 تلقائي (Auto Detect)').setValue('auto'),
                    new StringSelectMenuOptionBuilder().setLabel('1.16.5').setValue('1.16.5'),
                    new StringSelectMenuOptionBuilder().setLabel('1.20.1').setValue('1.20.1'),
                    new StringSelectMenuOptionBuilder().setLabel('1.20.4').setValue('1.20.4')
                );
            const row = new ActionRowBuilder().addComponents(selectMenu);
            await interaction.reply({ content: '⚙️ اختر الإصدار لبدء التشغيل:', components: [row], flags: [MessageFlags.Ephemeral] });
        }

        // زر الإطفاء: إخراج البوت من السيرفر
        if (interaction.customId === 'btn_stop_bot') {
            const mcBot = activeMinecraftBots.get(interaction.guild.id);
            if (!mcBot) return interaction.reply({ content: '⚠️ البوت لا يعمل حالياً.', flags: [MessageFlags.Ephemeral] });
            
            mcBot.quit(); // إخراج البوت
            activeMinecraftBots.delete(interaction.guild.id);
            await interaction.reply({ content: '🔴 تم إرسال أمر الإيقاف. سيخرج البوت من السيرفر الآن.', flags: [MessageFlags.Ephemeral] });
        }

        // زر تعديل الإعدادات: فتح نافذة منبثقة
        if (interaction.customId === 'btn_edit_settings') {
            const modal = new ModalBuilder().setCustomId('modal_edit_settings').setTitle('تعديل إعدادات البوت');
            
            const ipInput = new TextInputBuilder().setCustomId('edit_ip').setLabel('عنوان السيرفر (IP)').setStyle(TextInputStyle.Short).setValue(config.serverIp);
            const portInput = new TextInputBuilder().setCustomId('edit_port').setLabel('البورت (Port)').setStyle(TextInputStyle.Short).setValue(String(config.serverPort));
            const nameInput = new TextInputBuilder().setCustomId('edit_name').setLabel('اسم البوت').setStyle(TextInputStyle.Short).setValue(config.botName);

            modal.addComponents(
                new ActionRowBuilder().addComponents(ipInput),
                new ActionRowBuilder().addComponents(portInput),
                new ActionRowBuilder().addComponents(nameInput)
            );
            await interaction.showModal(modal);
        }
    }

    // ==========================================
    // ج- التعامل مع اختيار الإصدار وبدء المحرك
    // ==========================================
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_version_start') {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        
        const db = loadDB();
        const config = db[interaction.guild.id];
        const version = interaction.values[0];

        await interaction.followUp({ content: `🚀 جاري تشغيل البوت **${config.botName}** والاتصال بالسيرفر...` });
        
        // استدعاء دالة التشغيل مع تمرير بيانات هذا السيرفر
        startMinecraftBot(interaction.guild, config, version);
    }

    // ==========================================
    // د- التعامل مع حفظ تعديلات الإعدادات
    // ==========================================
    if (interaction.isModalSubmit() && interaction.customId === 'modal_edit_settings') {
        const db = loadDB();
        const config = db[interaction.guild.id];
        
        config.serverIp = interaction.fields.getTextInputValue('edit_ip');
        config.serverPort = parseInt(interaction.fields.getTextInputValue('edit_port')) || 25565;
        config.botName = interaction.fields.getTextInputValue('edit_name');
        
        saveDB(db);

        // تحديث رسالة الإعدادات
        sendSettingsMessage(interaction.channel, config);
        await interaction.reply({ content: '✅ تم حفظ التعديلات بنجاح!', flags: [MessageFlags.Ephemeral] });
    }
});

// ==========================================
// 3. دوال مساعدة لمحرك ماين كرافت والإعدادات
// ==========================================

// دالة لتحديث رسالة الإعدادات
async function sendSettingsMessage(channel, config) {
    const embed = new EmbedBuilder()
        .setTitle('⚙️ إعدادات السيرفر الحالية')
        .addFields(
            { name: 'اسم البوت', value: `\`${config.botName}\``, inline: true },
            { name: 'الآي بي (IP)', value: `\`${config.serverIp}\``, inline: true },
            { name: 'البورت (Port)', value: `\`${config.serverPort}\``, inline: true },
            { name: 'نوع الحساب', value: `\`${config.serverType}\``, inline: true }
        )
        .setColor('Orange');

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_edit_settings').setLabel('✏️ تعديل البيانات').setStyle(ButtonStyle.Primary)
    );

    // حذف الرسائل القديمة في قناة الإعدادات لتنظيفها
    const messages = await channel.messages.fetch({ limit: 10 });
    await channel.bulkDelete(messages).catch(() => {});
    
    await channel.send({ embeds: [embed], components: [row] });
}

// دالة تشغيل بوت ماين كرافت المستقلة لكل سيرفر
function startMinecraftBot(guild, config, version) {
    try {
        const botOptions = {
            host: config.serverIp,
            port: config.serverPort,
            username: config.botName,
            auth: config.serverType 
        };

        if (version !== 'auto') botOptions.version = version;

        const mcBot = mineflayer.createBot(botOptions);
        activeMinecraftBots.set(guild.id, mcBot); // حفظ البوت في الذاكرة لتتمكن من إطفائه لاحقاً

        // دالة مساعدة لإرسال السجلات لقناة الـ Logs
        const sendLog = (message) => {
            const logsChannel = guild.channels.cache.get(config.logsChannelId);
            if (logsChannel) logsChannel.send(message);
        };

        // 1. حدث الدخول
        mcBot.on('spawn', () => {
            sendLog(`🟢 **تم الاتصال!** دخل البوت \`${config.botName}\` إلى السيرفر.`);
            // تخطي حماية الحركة (تم شرحها مسبقاً)
            setTimeout(() => {
                if (mcBot.entity) {
                    mcBot.look(0.5, 0, true);
                    setTimeout(() => mcBot.setControlState('forward', true), 500);
                    setTimeout(() => mcBot.setControlState('forward', false), 1000);
                }
            }, 4000);
        });

        // 2. حدث الخروج الإرادي أو سقوط السيرفر
        mcBot.on('end', () => {
            sendLog(`🔴 **انقطع الاتصال.** خرج البوت من السيرفر.`);
            activeMinecraftBots.delete(guild.id);
        });

        // 3. حدث الطرد
        mcBot.on('kicked', (reason) => {
            const kickReason = typeof reason === 'object' ? JSON.stringify(reason) : String(reason);
            sendLog(`⚠️ **تم طرد البوت!** السبب: \n\`\`\`json\n${kickReason}\n\`\`\``);
            activeMinecraftBots.delete(guild.id);
        });

        // 4. حدث الموت (تمت إضافته كما طلبت)
        mcBot.on('death', () => {
            sendLog(`💀 **البوت مات!** عظم الله أجركم.`);
        });

        // 5. حدث الشات والرسائل الخاصة
        mcBot.on('message', (jsonMsg) => {
            const messageText = jsonMsg.toString().trim();
            // تجاهل الرسائل الفارغة لمنع السيرفر من حظر البوت بسبب الـ Spam
            if (messageText && messageText.length > 1) {
                sendLog(`💬 [شات اللعبة]: ${messageText}`);
            }
        });

        mcBot.on('error', (err) => {
            sendLog(`❌ **حدث خطأ برمجي:** ${err.message}`);
            activeMinecraftBots.delete(guild.id);
        });

    } catch (error) {
        console.error(`خطأ في الإنشاء: ${error.message}`);
        activeMinecraftBots.delete(guild.id);
    }
}

if (TOKEN) {
    client.login(TOKEN);
} else {
    console.error("❌ لم يتم العثور على توكن الديسكورد!");
}
