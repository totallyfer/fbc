const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  PermissionFlagsBits, 
  ChannelType,
  REST,
  Routes,
  SlashCommandBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder
} = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');
const http = require('http');

// ==========================================
// TRATAMENTO GLOBAL DE ERROS (EVITA QUEDAS NO RENDER)
// ==========================================
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ [unhandledRejection] Erro assíncrono capturado:', reason);
});

process.on('uncaughtException', (error, origin) => {
  console.error('💥 [uncaughtException] Exceção não tratada:', error, origin);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

const CONFIG_FILE = path.join(__dirname, 'config.json');
const ECONOMY_FILE = path.join(__dirname, 'economy.json');
const SETS_FILE = path.join(__dirname, 'sets.json');
const PREFIX = '?';

function loadData(file, defaultVal = {}) {
  try {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(defaultVal, null, 2));
    }
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`Erro ao carregar o ficheiro ${file}:`, err);
    return defaultVal;
  }
}

function saveData(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Erro ao guardar o ficheiro ${file}:`, err);
  }
}

// ==========================================
// BASE DE DADOS DOS SETS (MARTELOS DE FLEE THE FACILITY)
// ==========================================
const SETS = [
  { id: 1, name: "Party Ballons", rarity: "Rara", image: path.join(__dirname, 'assets', 'sets', 'party_ballons.png') },
  { id: 2, name: "Lovesick", rarity: "Rara", image: path.join(__dirname, 'assets', 'sets', 'lovesick.png') },
  { id: 3, name: "Gothic Bouquet", rarity: "Rara", image: path.join(__dirname, 'assets', 'sets', 'gothic_bouquet.png') },
  { id: 4, name: "Devlish", rarity: "Rara", image: path.join(__dirname, 'assets', 'sets', 'devlish.png') },
  { id: 5, name: "Spooky Brew", rarity: "Rara", image: path.join(__dirname, 'assets', 'sets', 'spooky_brew.png') },
  { id: 6, name: "Pumpkin Slice", rarity: "Rara", image: path.join(__dirname, 'assets', 'sets', 'pumpkin_slice.png') },
  { id: 7, name: "Cherry Bloosom", rarity: "Rara", image: path.join(__dirname, 'assets', 'sets', 'cherry_bloosom.png') },
  { id: 8, name: "Sakura Parasol", rarity: "Rara", image: path.join(__dirname, 'assets', 'sets', 'sakura_parasol.png') },
  { id: 9, name: "Devilborn", rarity: "Rara", image: path.join(__dirname, 'assets', 'sets', 'devilborn.png') },
  { id: 10, name: "Dark Mansion", rarity: "Rara", image: path.join(__dirname, 'assets', 'sets', 'dark_mansion.png') },
  { id: 11, name: "Phantom Light", rarity: "Rara", image: path.join(__dirname, 'assets', 'sets', 'phantom_light.png') },
  { id: 12, name: "Dark Bones", rarity: "Rara", image: path.join(__dirname, 'assets', 'sets', 'dark_bones.png') },
  { id: 13, name: "Classic", rarity: "Rara", image: path.join(__dirname, 'assets', 'sets', 'classic.png') },
  { id: 14, name: "Ice Cream", rarity: "Rara", image: path.join(__dirname, 'assets', 'sets', 'ice_cream.png') },
  { id: 15, name: "Pegasus Blade", rarity: "Épica", image: path.join(__dirname, 'assets', 'sets', 'pegasus_blade.png') },
  { id: 16, name: "Marine Anchor", rarity: "Épica", image: path.join(__dirname, 'assets', 'sets', 'marine_anchor.png') },
  { id: 17, name: "Phosphoros", rarity: "Épica", image: path.join(__dirname, 'assets', 'sets', 'phosphoros.png') },
  { id: 18, name: "Psycho Chainsaw", rarity: "Épica", image: path.join(__dirname, 'assets', 'sets', 'psycho_chainsaw.png') },
  { id: 19, name: "Egg Basket", rarity: "Épica", image: path.join(__dirname, 'assets', 'sets', 'egg_basket.png') },
  { id: 20, name: "Bloodthisrt Axe", rarity: "Épica", image: path.join(__dirname, 'assets', 'sets', 'bloodthisrt_axe.png') },
  { id: 21, name: "Paranormal", rarity: "Épica", image: path.join(__dirname, 'assets', 'sets', 'paranormal.png') },
  { id: 22, name: "Pot o'Gold", rarity: "Épica", image: path.join(__dirname, 'assets', 'sets', 'pot_gold.png') },
  { id: 23, name: "Acidic Potion", rarity: "Épica", image: path.join(__dirname, 'assets', 'sets', 'acidic_potion.png') },
  { id: 24, name: "Dragon Puppet", rarity: "Épica", image: path.join(__dirname, 'assets', 'sets', 'dragon_puppet.png') },
  { id: 25, name: "Spring World", rarity: "Épica", image: path.join(__dirname, 'assets', 'sets', 'spring_world.png') },
  { id: 26, name: "Piñata", rarity: "Épica", image: path.join(__dirname, 'assets', 'sets', 'pinata.png') },
  { id: 27, name: "Light Bone", rarity: "Épica", image: path.join(__dirname, 'assets', 'sets', 'light_bone.png') },
  { id: 28, name: "Witch Hunter", rarity: "Lendária", image: path.join(__dirname, 'assets', 'sets', 'witch_hunter.png') },
  { id: 29, name: "Warlock Hunter", rarity: "Lendária", image: path.join(__dirname, 'assets', 'sets', 'warlock_hunter.png') },
  { id: 30, name: "Alchemist Hunter", rarity: "Lendária", image: path.join(__dirname, 'assets', 'sets', 'alchemist_hunter.png') },
  { id: 31, name: "Bubbly Gun", rarity: "Lendária", image: path.join(__dirname, 'assets', 'sets', 'bubbly_gun.png') },
  { id: 32, name: "Strawberry Basket", rarity: "Lendária", image: path.join(__dirname, 'assets', 'sets', 'strawberry_basket.png') },
  { id: 33, name: "Lemon Basket", rarity: "Lendária", image: path.join(__dirname, 'assets', 'sets', 'lemon_basket.png') },
  { id: 34, name: "Blueberry Basket", rarity: "Lendária", image: path.join(__dirname, 'assets', 'sets', 'blueberry_basket.png') },
  { id: 35, name: "Coffin", rarity: "Lendária", image: path.join(__dirname, 'assets', 'sets', 'coffin.png') },
  { id: 36, name: "Thombstone", rarity: "Lendária", image: path.join(__dirname, 'assets', 'sets', 'thombstone.png') },
  { id: 37, name: "Ancestral Trident", rarity: "Lendária", image: path.join(__dirname, 'assets', 'sets', 'ancestral_trident.png') },
  { id: 38, name: "Mothership", rarity: "Lendária", image: path.join(__dirname, 'assets', 'sets', 'mothership.png') },
  { id: 39, name: "Mystical Trident", rarity: "Lendária de Robux", image: path.join(__dirname, 'assets', 'sets', 'mystical_trident.png') },
  { id: 40, name: "Ancient Trident", rarity: "Lendária de Robux", image: path.join(__dirname, 'assets', 'sets', 'ancient_trident.png') },
  { id: 41, name: "Choco Dip", rarity: "Lendária de Robux", image: path.join(__dirname, 'assets', 'sets', 'choco_dip.png') },
  { id: 42, name: "Psycho Axe", rarity: "Lendária de Robux", image: path.join(__dirname, 'assets', 'sets', 'psycho_axe.png') },
  { id: 43, name: "WaterGun", rarity: "Lendária de Robux", image: path.join(__dirname, 'assets', 'sets', 'watergun.png') },
  { id: 44, name: "Lemoned Jar", rarity: "Lendária de Robux", image: path.join(__dirname, 'assets', 'sets', 'lemoned_jar.png') },
  { id: 45, name: "Ube Rol", rarity: "Lendária de Robux", image: path.join(__dirname, 'assets', 'sets', 'ube_rol.png') },
  { id: 46, name: "Red Panda", rarity: "Lendária de Robux", image: path.join(__dirname, 'assets', 'sets', 'red_panda.png') },
  { id: 47, name: "Sour Candy", rarity: "Lendária de Robux", image: path.join(__dirname, 'assets', 'sets', 'sour_candy.png') },
  { id: 48, name: "Blue Star Warp", rarity: "Lendária de Robux", image: path.join(__dirname, 'assets', 'sets', 'blue_star_warp.png') },
  { id: 49, name: "Pink Star Wrap", rarity: "Lendária de Robux", image: path.join(__dirname, 'assets', 'sets', 'pink_star_wrap.png') },
  { id: 50, name: "Bleak Ink", rarity: "Lendária de Robux", image: path.join(__dirname, 'assets', 'sets', 'bleak_ink.png') }
];

const commands = [
  new SlashCommandBuilder().setName('set').setDescription('Sorteie um set de Flee the Facility!'),
  new SlashCommandBuilder().setName('inventario').setDescription('Visualiza o inventário de sets.').addUserOption(opt => opt.setName('usuario').setDescription('Membro').setRequired(false)),
  new SlashCommandBuilder().setName('saldo').setDescription('Verifica o saldo.'),
  new SlashCommandBuilder().setName('work').setDescription('Trabalhe para ganhar moedas.'),
  new SlashCommandBuilder().setName('leaderboard').setDescription('Ranking de moedas.')
].map(command => command.toJSON());

client.once('ready', async () => {
  console.log(`🤖 Bot online como ${client.user.tag}!`);
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ Comandos Slash registrados!');
  } catch (error) {
    console.error('❌ Erro ao registrar comandos:', error);
  }
});

function loadJson(file, def) {
  try {
    if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(def, null, 2));
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) { return def; }
}

function saveJson(file, data) {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); } catch(e){}
}

function getUserSets(guildId, userId) {
  let db = loadJson(SETS_FILE, {});
  if (!db[guildId]) db[guildId] = {};
  if (!db[guildId][userId]) db[guildId][userId] = { pending: null, cooldown: 0, inventory: {} };
  return db[guildId][userId];
}

// ==========================================
// FUNÇÃO DE SORTEIO DE SETS (?set / /set)
// ==========================================
async function handleSetCommand(messageOrInteraction, user, guildId) {
  let dbSets = loadJson(SETS_FILE, {});
  const userSetData = getUserSets(guildId, user.id);
  const cooldownTime = 10 * 60 * 1000; // 10 minutos
  const now = Date.now();

  if (now - userSetData.cooldown < cooldownTime) {
    const timeLeft = Math.ceil((cooldownTime - (now - userSetData.cooldown)) / 1000);
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    const msg = `⏳ Você precisa esperar **${mins}m ${secs}s** para sortear um set novamente.`;
    return messageOrInteraction.reply ? await messageOrInteraction.reply({ content: msg, ephemeral: true }) : await messageOrInteraction.channel.send(msg);
  }

  // Sorteio por Porcentagem de Raridade
  const randomChance = Math.floor(Math.random() * 100) + 1;
  let selectedRarity = 'Rara';
  if (randomChance >= 61 && randomChance < 86) selectedRarity = 'Épica';
  else if (randomChance >= 86 && randomChance < 96) selectedRarity = 'Lendária';
  else if (randomChance >= 96) selectedRarity = 'Lendária de Robux';

  const filteredSets = SETS.filter(s => s.rarity === selectedRarity);
  const pendingSet = filteredSets[Math.floor(Math.random() * filteredSets.length)];

  userSetData.pending = pendingSet.id;
  userSetData.cooldown = now;
  dbSets[guildId][user.id] = userSetData;
  saveJson(SETS_FILE, dbSets);

  let filesArr = [];
  let thumbnailProp = null;
  
  if (fs.existsSync(pendingSet.image)) {
    const fileName = path.basename(pendingSet.image);
    filesArr.push(new AttachmentBuilder(pendingSet.image, { name: fileName }));
    thumbnailProp = `attachment://${fileName}`;
  }

  const embed = new EmbedBuilder()
    .setColor('#2196F3')
    .setTitle('🎉 Você ganhou um Set!')
    .setDescription(`## ${pendingSet.name}\n\n**Raridade:** ${pendingSet.rarity}\n\nClique no botão abaixo para resgatar este item para o seu inventário!`);

  if (thumbnailProp) {
    embed.setThumbnail(thumbnailProp);
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`claim_set_${pendingSet.id}`)
      .setLabel('Resgatar Set')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🎁')
  );

  if (messageOrInteraction.reply) {
    return await messageOrInteraction.reply({ embeds: [embed], components: [row], files: filesArr });
  } else {
    return await messageOrInteraction.channel.send({ embeds: [embed], components: [row], files: filesArr });
  }
}

// ==========================================
// FUNÇÃO DO INVENTÁRIO (VISUAL EM CANVAS)
// ==========================================
async function handleInventory(messageOrInteraction, targetUser, guildId, activeCategory = 'Todas', isUpdate = false) {
  let dbSets = loadJson(SETS_FILE, {});
  const userSetData = (dbSets[guildId] && dbSets[guildId][targetUser.id]) ? dbSets[guildId][targetUser.id] : { inventory: {} };
  const userInventory = userSetData.inventory || {};

  const userOwnedSets = SETS.filter(s => (userInventory[s.id] || 0) > 0);
  const filteredSets = activeCategory === 'Todas' ? userOwnedSets : userOwnedSets.filter(s => s.rarity === activeCategory);

  const canvas = createCanvas(1000, 500);
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, 1000, 500);
  gradient.addColorStop(0, '#0a192f');
  gradient.addColorStop(1, '#004080');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1000, 500);

  try {
    const avatarURL = targetUser.displayAvatarURL({ extension: 'png', size: 256 });
    const avatarImg = await loadImage(avatarURL);
    ctx.save();
    ctx.beginPath();
    ctx.arc(100, 100, 60, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatarImg, 40, 40, 120, 120);
    ctx.restore();

    ctx.strokeStyle = '#2196F3';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(100, 100, 60, 0, Math.PI * 2, true);
    ctx.stroke();
  } catch (err) {}

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText(targetUser.username, 180, 90);

  ctx.fillStyle = '#2196F3';
  ctx.font = '20px sans-serif';
  ctx.fillText(`Categoria: ${activeCategory} (${filteredSets.length} Sets)`, 180, 125);

  const startX = 50;
  const startY = 180;
  const boxSize = 80;
  const gap = 20;
  const maxCols = 8;

  for (let i = 0; i < Math.min(filteredSets.length, 24); i++) {
    const setItem = filteredSets[i];
    const col = i % maxCols;
    const row = Math.floor(i / maxCols);
    const x = startX + col * (boxSize + gap);
    const y = startY + row * (boxSize + gap);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.strokeStyle = '#2196F3';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, boxSize, boxSize, 10);
    ctx.fill();
    ctx.stroke();

    try {
      if (fs.existsSync(setItem.image)) {
        const setImg = await loadImage(setItem.image);
        ctx.drawImage(setImg, x + 5, y + 5, boxSize - 10, boxSize - 10);
      }
    } catch (e) {}

    const count = userInventory[setItem.id];
    ctx.fillStyle = '#2196F3';
    ctx.beginPath();
    ctx.arc(x + boxSize - 12, y + 12, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${count}`, x + boxSize - 12, y + 16);
    ctx.textAlign = 'left';
  }

  const attachment = new AttachmentBuilder(await canvas.encode('png'), { name: 'inventario.png' });

  let descText = `📦 **Inventário de <@${targetUser.id}>**\n\n`;
  if (filteredSets.length === 0) {
    descText += `*Nenhum set encontrado na categoria **${activeCategory}**.*`;
  } else {
    filteredSets.forEach(setItem => {
      const qty = userInventory[setItem.id];
      descText += `• **${setItem.name}**: ${qty}x\n`;
    });
  }

  const embed = new EmbedBuilder().setColor('#2196F3').setDescription(descText).setImage('attachment://inventario.png');
  const categories = ['Todas', 'Rara', 'Épica', 'Lendária', 'Lendária de Robux'];
  const row = new ActionRowBuilder();

  categories.forEach(cat => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`inv_cat_${targetUser.id}_${cat}`)
        .setLabel(cat)
        .setStyle(activeCategory === cat ? ButtonStyle.Primary : ButtonStyle.Secondary)
    );
  });

  const replyData = { embeds: [embed], files: [attachment], components: [row] };

  if (isUpdate) return await messageOrInteraction.update(replyData);
  if (messageOrInteraction.reply) return await messageOrInteraction.reply(replyData);
  return await messageOrInteraction.channel.send(replyData);
}

// ==========================================
// EVENTO DE MENSAGENS (PREFIXO ?)
// ==========================================
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  const guildId = message.guild.id;

  if (command === 'set') {
    await handleSetCommand(message, message.author, guildId);
  }

  if (command === 'inventario') {
    const target = message.mentions.users.first() || message.author;
    await handleInventory(message, target, guildId, 'Todas', false);
  }
});

// ==========================================
// EVENTO DE INTERAÇÕES (SLASH & BOTÕES)
// ==========================================
client.on('interactionCreate', async interaction => {
  if (!interaction.guild) return;
  const guildId = interaction.guild.id;

  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'set') {
      await handleSetCommand(interaction, interaction.user, guildId);
    }
    if (interaction.commandName === 'inventario') {
      const target = interaction.options.getUser('usuario') || interaction.user;
      await handleInventory(interaction, target, guildId, 'Todas', false);
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId.startsWith('claim_set_')) {
      const setId = parseInt(interaction.customId.split('_')[2]);
      let dbSets = loadJson(SETS_FILE, {});
      const userSetData = getUserSets(guildId, interaction.user.id);

      if (!userSetData.pending || userSetData.pending !== setId) {
        return interaction.reply({ content: '❌ Este set não está disponível para resgate por você!', ephemeral: true });
      }

      if (!userSetData.inventory[setId]) userSetData.inventory[setId] = 0;
      userSetData.inventory[setId] += 1;
      userSetData.pending = null;
      dbSets[guildId][interaction.user.id] = userSetData;
      saveJson(SETS_FILE, dbSets);

      const claimedSet = SETS.find(s => s.id === setId);
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('claimed').setLabel('🎁 Set Resgatado').setStyle(ButtonStyle.Secondary).setDisabled(true)
      );

      let filesArr = [];
      let thumbnailProp = null;
      if (fs.existsSync(claimedSet.image)) {
        const fileName = path.basename(claimedSet.image);
        filesArr.push(new AttachmentBuilder(claimedSet.image, { name: fileName }));
        thumbnailProp = `attachment://${fileName}`;
      }

      const embed = new EmbedBuilder()
        .setColor('#2196F3')
        .setTitle('Set Resgatado com Sucesso!')
        .setDescription(`O set **${claimedSet.name}** foi adicionado ao seu inventário!\n\n**Use \`?inventario\` ou \`/inventario\` para visualizar seu inventário.**`);

      if (thumbnailProp) embed.setThumbnail(thumbnailProp);

      return await interaction.update({ embeds: [embed], components: [disabledRow], files: filesArr });
    }

    if (interaction.customId.startsWith('inv_cat_')) {
      const [, , targetId, category] = interaction.customId.split('_');
      if (interaction.user.id !== targetId) {
        return interaction.reply({ content: '❌ Você não pode alterar o inventário de outra pessoa.', ephemeral: true });
      }
      const targetUser = await client.users.fetch(targetId);
      return await handleInventory(interaction, targetUser, guildId, category, true);
    }
  }
});

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot online!\n');
});

server.listen(process.env.PORT || 3000);
client.login(process.env.DISCORD_TOKEN);
