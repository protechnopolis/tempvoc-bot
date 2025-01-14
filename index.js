const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');

const configPath = path.resolve(__dirname, './config.json');
const tempVocPath = path.resolve(__dirname, './tempvoc.json');
const config = require(configPath);
if (!fs.existsSync(tempVocPath)) fs.writeFileSync(tempVocPath, JSON.stringify({}, null, 4));
const tempVocConfig = require(tempVocPath);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

client.once('ready', async () => {
    const commands = [
        {
            name: 'set_tempvoc',
            description: 'Configurer les salons vocaux temporaires 🛠️',
            options: [
                {
                    name: 'channel',
                    description: 'Salon vocal déclencheur 🎙️',
                    type: 7,
                    required: true
                },
                {
                    name: 'category',
                    description: 'Catégorie des salons temporaires 📂',
                    type: 7,
                    required: true
                }
            ]
        }
    ];

    const rest = new REST({ version: '10' }).setToken(config.token);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;
    if (interaction.commandName === 'set_tempvoc') {
        const channel = interaction.options.getChannel('channel');
        const category = interaction.options.getChannel('category');
        if (channel.type !== 2 || category.type !== 4) {
            return interaction.reply({ content: '❌ Choisissez un salon vocal et une catégorie.', ephemeral: true });
        }
        tempVocConfig[interaction.guild.id] = {
            tempVocChannelId: channel.id,
            tempVocCategoryId: category.id
        };
        fs.writeFileSync(tempVocPath, JSON.stringify(tempVocConfig, null, 4));
        interaction.reply({ content: `✅ Config OK : ${channel.name} 🎙️, ${category.name} 📂`, ephemeral: true });
    }
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        if (!oldState.channel && newState.channel) {
            const config = tempVocConfig[newState.guild.id];
            if (!config || newState.channel.id !== config.tempVocChannelId) return;

            const user = newState.member.user;
            const newChannel = await newState.guild.channels.create({
                name: `Salon de ${user.username} ✨`,
                type: 2,
                parent: config.tempVocCategoryId,
                permissionOverwrites: [
                    { id: newState.guild.roles.everyone, deny: ['Connect'] },
                    { id: newState.member.id, allow: ['Connect'] }
                ]
            });

            await newState.member.voice.setChannel(newChannel);
            const interval = setInterval(async () => {
                if (!newChannel.members.size) {
                    clearInterval(interval);
                    await newChannel.delete();
                }
            }, 1000);
        }
    } catch (err) {
        console.error('❌ Erreur :', err);
    }
});

client.login(config.token);
