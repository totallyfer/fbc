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
// TRATAMENTO GLOBAL DE ERROS
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
const CUSTOM_SETS_FILE = path.join(__dirname, 'custom_sets.json');
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
// REGISTRO DE COMANDOS SLASH
// ==========================================
const commands = [
  new SlashCommandBuilder()
    .setName('config')
    .setDescription('Painel de configuração do servidor.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers | PermissionFlagsBits.Administrator)
    .addSubcommand(sub => 
      sub.setName('sets')
        .setDescription('Adiciona um novo set de Flee the Facility ao sistema.')
        .addStringOption(opt => opt.setName('nome').setDescription('Nome do set / martelo').setRequired(true))
        .addStringOption(opt => 
          opt.setName('raridade')
            .setDescription('Selecione a raridade do set')
            .setRequired(true)
            .addChoices(
              { name: 'Comum', value: 'Comum' },
              { name: 'Rara', value: 'Rara' },
              { name: 'Épica', value: 'Épica' },
              { name: 'Lendária', value: 'Lendária' },
              { name: 'Lendária de Robux', value: 'Lendária de Robux' }
            )
        )
        .addAttachmentOption(opt => opt.setName('imagem').setDescription('Envie a imagem do set/martelo').setRequired(true))
    )
    .addSubcommand(sub => 
      sub.setName('inventario')
        .setDescription('Altera a imagem de fundo do inventário.')
        .addAttachmentOption(opt => opt.setName('fundo').setDescription('Envie a imagem de fundo (PNG/JPG)').setRequired(true))
    )
    .addSubcommand(sub => 
      sub.setName('economia')
        .setDescription('Gerencia as configurações de economia e o fundo da Leaderboard.')
        .addAttachmentOption(opt => opt.setName('fundo_leaderboard').setDescription('Envie a imagem de fundo para a Leaderboard (Opcional)').setRequired(false))
    )
    .addSubcommand(sub => 
      sub.setName('ticket')
        .setDescription('Gerencia e configura o sistema de tickets.')
        .addStringOption(opt => opt.setName('titulo').setDescription('Título do painel de tickets').setRequired(false))
        .addStringOption(opt => opt.setName('descricao').setDescription('Descrição do painel de tickets').setRequired(false))
        .addAttachmentOption(opt => opt.setName('imagem_arquivo').setDescription('Imagem principal do painel (anexo)').setRequired(false))
        .addAttachmentOption(opt => opt.setName('miniatura_arquivo').setDescription('Miniatura / Thumbnail do painel (anexo)').setRequired(false))
        .addRoleOption(opt => opt.setName('cargo_staff').setDescription('Cargo de atendimento da staff').setRequired(false))
        .addChannelOption(opt => opt.setName('canal_envio').setDescription('Canal onde o painel será enviado').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('portao')
        .setDescription('Configura o sistema de entrada e saída (Portão).')
        .addStringOption(opt => 
          opt.setName('tipo')
            .setDescription('Deseja configurar a Entrada ou a Saída?')
            .setRequired(true)
            .addChoices(
              { name: 'Entrada (Welcome)', value: 'entrada' },
              { name: 'Saída (Leave)', value: 'saida' }
            )
        )
        .addChannelOption(opt => opt.setName('canal').setDescription('Canal de portão para os avisos').setRequired(false))
        .addStringOption(opt => opt.setName('titulo').setDescription('Título da embed (use {user} para o nome)').setRequired(false))
        .addStringOption(opt => opt.setName('descricao').setDescription('Descrição da embed (use {user} para marcar)').setRequired(false))
        .addStringOption(opt => opt.setName('cor').setDescription('Cor da embed em Hex (Ex: #57F287)').setRequired(false))
        .addAttachmentOption(opt => opt.setName('miniatura').setDescription('Miniatura / Thumbnail da embed (anexo)').setRequired(false))
    ),

  new SlashCommandBuilder().setName('set').setDescription('Sorteie um set de Flee the Facility cadastrado!'),
  new SlashCommandBuilder().setName('inventario').setDescription('Visualiza o inventário de sets.').addUserOption(opt => opt.setName('usuario').setDescription('Membro').setRequired(false)),
  new SlashCommandBuilder().setName('saldo').setDescription('Verifica o seu saldo ou de outro membro.').addUserOption(opt => opt.setName('usuario').setDescription('Membro para ver o saldo').setRequired(false)),
  new SlashCommandBuilder().setName('work').setDescription('Trabalhe em sua profissão para ganhar moedas na cidade!'),
  new SlashCommandBuilder().setName('pagar').setDescription('Transfere moedas para outro membro.').addUserOption(opt => opt.setName('usuario').setDescription('Quem vai receber').setRequired(true)).addIntegerOption(opt => opt.setName('quantia').setDescription('Valor a ser pago').setRequired(true)),
  new SlashCommandBuilder().setName('leaderboard').setDescription('Mostra o ranking visual de moedas da cidade.')
].map(command => command.toJSON());

client.once('ready', async () => {
  console.log(`🤖 Bot online como ${client.user.tag}!`);
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ Comandos Slash registrados com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao registrar comandos:', error);
  }
});

function getGuildConfig(guildId) {
  let db = loadData(CONFIG_FILE, {});
  if (!db[guildId]) {
    db[guildId] = {
      ticket: {
        title: '🎫 Central de Atendimento & Suporte',
        description: 'Selecione abaixo o motivo do seu contato para abrir um ticket.',
        image: '',
        thumbnail: '',
        staffRoleId: null,
        targetChannelId: null
      },
      economy: {
        minWork: 80,
        maxWork: 250
      },
      backgrounds: {
        inventory: '',
        leaderboard: ''
      },
      portao: {
        entrada: {
          channelId: null,
          title: '👋 Novo Membro Chegou!',
          description: 'Seja bem-vindo(a) ao servidor, {user}!',
          color: '#57F287',
          thumbnail: ''
        },
        saida: {
          channelId: null,
          title: '🚪 Membro Saiu',
          description: '**{user}** saiu do servidor. Esperamos que volte logo!',
          color: '#ED4245',
          thumbnail: ''
        }
      }
    };
    saveData(CONFIG_FILE, db);
  }
  if (!db[guildId].backgrounds) {
    db[guildId].backgrounds = { inventory: '', leaderboard: '' };
  }
  if (!db[guildId].portao) {
    db[guildId].portao = {
      entrada: { channelId: null, title: '👋 Novo Membro Chegou!', description: 'Seja bem-vindo(a) ao servidor, {user}!', color: '#57F287', thumbnail: '' },
      saida: { channelId: null, title: '🚪 Membro Saiu', description: '**{user}** saiu do servidor.', color: '#ED4245', thumbnail: '' }
    };
  }
  return db[guildId];
}

function getUserEco(dbEco, guildId, userId) {
  if (!dbEco[guildId]) dbEco[guildId] = {};
  if (!dbEco[guildId][userId]) {
    dbEco[guildId][userId] = { wallet: 150, bank: 500, lastWork: 0 };
  }
  return dbEco[guildId][userId];
}

function getGuildCustomSets(guildId) {
  let db = loadData(CUSTOM_SETS_FILE, {});
  if (!db[guildId]) {
    db[guildId] = [];
    saveData(CUSTOM_SETS_FILE, db);
  }
  return db[guildId];
}

function getUserSets(guildId, userId) {
  let db = loadData(CUSTOM_SETS_FILE + '_user', {});
  if (!db[guildId]) db[guildId] = {};
  if (!db[guildId][userId]) db[guildId][userId] = { pending: null, cooldown: 0, inventory: {} };
  return db[guildId][userId];
}

function saveUserSets(guildId, userId, data) {
  let db = loadData(CUSTOM_SETS_FILE + '_user', {});
  if (!db[guildId]) db[guildId] = {};
  db[guildId][userId] = data;
  saveData(CUSTOM_SETS_FILE + '_user', db);
}

// ==========================================
// FUNÇÕES DE ECONOMIA
// ==========================================
async function handleWork(messageOrInteraction, user, guildId, guildCfg) {
  let dbEco = loadData(ECONOMY_FILE, {});
  const eco = getUserEco(dbEco, guildId, user.id);
  const cooldown = 30000;
  
  if (Date.now() - eco.lastWork < cooldown) {
    const timeLeft = Math.ceil((cooldown - (Date.now() - eco.lastWork)) / 1000);
    const content = `⏳ Você está descansando! Volte a trabalhar em **${timeLeft} segundos**.`;
    return messageOrInteraction.reply ? await messageOrInteraction.reply({ content, ephemeral: true }) : await messageOrInteraction.channel.send(content);
  }

  const trabalhos = [
    { cargo: 'Programador', msg: 'criou scripts incríveis' },
    { cargo: 'Policial', msg: 'patrulhou as ruas da cidade' },
    { cargo: 'Entregador', msg: 'fez entregas expressas' },
    { cargo: 'Cozinheiro', msg: 'preparou pratos no restaurante' },
    { cargo: 'Mecânico', msg: 'consertou veículos na oficina' }
  ];

  const job = trabalhos[Math.floor(Math.random() * trabalhos.length)];
  const min = guildCfg.economy.minWork;
  const max = guildCfg.economy.maxWork;
  const earnings = Math.floor(Math.random() * (max - min + 1)) + min;

  eco.wallet += earnings;
  eco.lastWork = Date.now();
  saveData(ECONOMY_FILE, dbEco);

  const embed = new EmbedBuilder()
    .setColor('#57F287')
    .setTitle('💼 Trabalho Realizado!')
    .setDescription(`Você trabalhou como **${job.cargo}** e ${job.msg}!`)
    .addFields(
      { name: '💵 Salário', value: `**+$${earnings}**`, inline: true },
      { name: '💰 Carteira', value: `**$${eco.wallet}**`, inline: true }
    )
    .setTimestamp();

  if (messageOrInteraction.reply) {
    return await messageOrInteraction.reply({ embeds: [embed] });
  } else {
    return await messageOrInteraction.channel.send({ embeds: [embed] });
  }
}

async function handleSaldo(messageOrInteraction, targetUser, guildId) {
  let dbEco = loadData(ECONOMY_FILE, {});
  const eco = getUserEco(dbEco, guildId, targetUser.id);
  saveData(ECONOMY_FILE, dbEco);

  const total = eco.wallet + eco.bank;

  const embed = new EmbedBuilder()
    .setColor('#2b2d31')
    .setAuthor({ name: `Extrato Bancário • ${targetUser.username}`, iconURL: targetUser.displayAvatarURL() })
    .setDescription(`Detalhes financeiros da conta de ${targetUser}.`)
    .addFields(
      { name: '💵 Carteira', value: `\`$${eco.wallet.toLocaleString()}\``, inline: true },
      { name: '🏦 Banco', value: `\`$${eco.bank.toLocaleString()}\``, inline: true },
      { name: '💎 Patrimônio Total', value: `\`$${total.toLocaleString()}\``, inline: false }
    )
    .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
    .setFooter({ text: 'Sistema Financeiro da Cidade', iconURL: messageOrInteraction.guild.iconURL() })
    .setTimestamp();

  if (messageOrInteraction.reply) {
    return await messageOrInteraction.reply({ embeds: [embed] });
  } else {
    return await messageOrInteraction.channel.send({ embeds: [embed] });
  }
}

async function handleLeaderboard(messageOrInteraction, guild) {
  let dbEco = loadData(ECONOMY_FILE, {});
  const guildCfg = getGuildConfig(guild.id);
  const guildEconomy = dbEco[guild.id] || {};
  const sortedUsers = Object.entries(guildEconomy)
    .map(([userId, data]) => ({ userId, total: data.wallet + data.bank, wallet: data.wallet, bank: data.bank }))
    .sort((a, b) => b.total - a.total);

  if (sortedUsers.length === 0) {
    const msg = '❌ Ainda não há registros na economia deste servidor.';
    return messageOrInteraction.reply ? await messageOrInteraction.reply({ content: msg }) : await messageOrInteraction.channel.send(msg);
  }

  async function generateLeaderboardImage(page) {
    const canvas = createCanvas(900, 850);
    const ctx = canvas.getContext('2d');

    let bgLoaded = false;
    if (guildCfg.backgrounds && guildCfg.backgrounds.leaderboard && fs.existsSync(guildCfg.backgrounds.leaderboard)) {
      try {
        const bgImg = await loadImage(guildCfg.backgrounds.leaderboard);
        ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
        bgLoaded = true;
      } catch (e) {}
    }

    if (!bgLoaded) {
      ctx.fillStyle = '#111214';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.fillStyle = 'rgba(23, 24, 28, 0.90)';
    ctx.fillRect(0, 0, canvas.width, 120);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(guild.name, 50, 70);

    try {
      if (guild.iconURL()) {
        const guildIcon = await loadImage(guild.iconURL({ extension: 'png', size: 128 }));
        ctx.save();
        ctx.beginPath();
        ctx.arc(830, 60, 35, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(guildIcon, 795, 25, 70, 70);
        ctx.restore();
      }
    } catch (e) {}

    const start = page * 10;
    const currentSlice = sortedUsers.slice(start, start + 10);

    let y = 145;
    for (let i = 0; i < currentSlice.length; i++) {
      const entry = currentSlice[i];
      const rank = start + i + 1;
      let member;
      try {
        member = await guild.members.fetch(entry.userId);
      } catch {
        member = { user: { username: 'Membro Desconhecido', id: entry.userId }, displayAvatarURL: () => 'https://cdn.discord-icons.com/default.png' };
      }

      ctx.fillStyle = 'rgba(34, 35, 39, 0.92)';
      ctx.beginPath();
      ctx.roundRect(40, y, 820, 70, 14);
      ctx.fill();

      try {
        const avatarImg = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 256 }));
        ctx.save();
        ctx.beginPath();
        ctx.arc(85, y + 35, 28, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatarImg, 57, y + 7, 56, 56);
        ctx.restore();
      } catch (e) {}

      ctx.fillStyle = rank === 1 ? '#fEE75C' : rank === 2 ? '#BCC0C4' : rank === 3 ? '#EB459E' : '#ffffff';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(`#${rank}  ${member.user.username}`, 135, y + 32);

      ctx.fillStyle = '#b5bac1';
      ctx.font = '16px sans-serif';
      ctx.fillText(`ID: ${member.userId}`, 135, y + 55);

      ctx.fillStyle = '#57F287';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`$${entry.total.toLocaleString()}`, 835, y + 43);
      ctx.textAlign = 'left';

      y += 82;
    }

    return new AttachmentBuilder(await canvas.encode('png'), { name: 'leaderboard.png' });
  }

  let currentPage = 0;
  const maxPages = Math.ceil(sortedUsers.length / 10) - 1;

  const attachment = await generateLeaderboardImage(currentPage);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('lb_prev').setLabel('◀ Anterior').setStyle(ButtonStyle.Primary).setDisabled(currentPage === 0),
    new ButtonBuilder().setCustomId('lb_next').setLabel('Próxima ▶').setStyle(ButtonStyle.Primary).setDisabled(currentPage >= maxPages)
  );

  let msg;
  if (messageOrInteraction.reply) {
    msg = await messageOrInteraction.reply({ files: [attachment], components: [row], fetchReply: true });
  } else {
    msg = await messageOrInteraction.channel.send({ files: [attachment], components: [row] });
  }

  const authorId = messageOrInteraction.user ? messageOrInteraction.user.id : messageOrInteraction.author.id;
  const collector = msg.createMessageComponentCollector({ time: 60000 });
  
  collector.on('collect', async i => {
    if (i.user.id !== authorId) return i.reply({ content: '❌ Você não pode controlar este painel!', ephemeral: true });

    if (i.customId === 'lb_prev') currentPage--;
    if (i.customId === 'lb_next') currentPage++;

    const newAttachment = await generateLeaderboardImage(currentPage);
    const newRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('lb_prev').setLabel('◀ Anterior').setStyle(ButtonStyle.Primary).setDisabled(currentPage === 0),
      new ButtonBuilder().setCustomId('lb_next').setLabel('Próxima ▶').setStyle(ButtonStyle.Primary).setDisabled(currentPage >= maxPages)
    );

    await i.update({ files: [newAttachment], components: [newRow] });
  });
}

// ==========================================
// SORTEIO DE SETS
// ==========================================
async function handleSetCommand(messageOrInteraction, user, guildId) {
  const guildSets = getGuildCustomSets(guildId);
  if (!guildSets || guildSets.length === 0) {
    const msg = '❌ Nenhum set foi cadastrado neste servidor ainda! Use `/config sets` para adicionar.';
    return messageOrInteraction.reply ? await messageOrInteraction.reply({ content: msg, ephemeral: true }) : await messageOrInteraction.channel.send(msg);
  }

  const userSetData = getUserSets(guildId, user.id);
  const cooldownTime = 10 * 60 * 1000; // 10 Minutos
  const now = Date.now();

  if (now - userSetData.cooldown < cooldownTime) {
    const timeLeft = Math.ceil((cooldownTime - (now - userSetData.cooldown)) / 1000);
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    const msg = `⏳ Você precisa esperar **${mins}m ${secs}s** para sortear um set novamente.`;
    return messageOrInteraction.reply ? await messageOrInteraction.reply({ content: msg, ephemeral: true }) : await messageOrInteraction.channel.send(msg);
  }

  const randomChance = Math.floor(Math.random() * 100) + 1;
  let selectedRarity = 'Comum';
  if (randomChance > 40 && randomChance <= 70) selectedRarity = 'Rara';
  else if (randomChance > 70 && randomChance <= 90) selectedRarity = 'Épica';
  else if (randomChance > 90 && randomChance <= 97) selectedRarity = 'Lendária';
  else if (randomChance > 97) selectedRarity = 'Lendária de Robux';

  let filteredSets = guildSets.filter(s => s.rarity === selectedRarity);
  if (filteredSets.length === 0) filteredSets = guildSets;

  const pendingSet = filteredSets[Math.floor(Math.random() * filteredSets.length)];

  userSetData.pending = pendingSet.id;
  userSetData.cooldown = now;
  saveUserSets(guildId, user.id, userSetData);

  let filesArr = [];
  let thumbnailProp = null;

  if (pendingSet.imagePath && fs.existsSync(pendingSet.imagePath)) {
    const fileName = path.basename(pendingSet.imagePath);
    filesArr.push(new AttachmentBuilder(pendingSet.imagePath, { name: fileName }));
    thumbnailProp = `attachment://${fileName}`;
  }

  const embed = new EmbedBuilder()
    .setColor('#2196F3')
    .setTitle('🎉 Você ganhou um Set!')
    .setDescription(`**Raridade:** ${pendingSet.rarity}\n\nClique no botão abaixo para resgatar este item para o seu inventário!`);

  if (thumbnailProp) embed.setThumbnail(thumbnailProp);

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
// INVENTÁRIO COM FUNDO CUSTOMIZÁVEL
// ==========================================
async function handleInventory(messageOrInteraction, targetUser, guildId, activeCategory = 'Todas', isUpdate = false) {
  const guildSets = getGuildCustomSets(guildId);
  const guildCfg = getGuildConfig(guildId);
  let userSetData = getUserSets(guildId, targetUser.id);
  const userInventory = userSetData.inventory || {};

  const userOwnedSets = guildSets.filter(s => (userInventory[s.id] || 0) > 0);
  const filteredSets = activeCategory === 'Todas' ? userOwnedSets : userOwnedSets.filter(s => s.rarity === activeCategory);

  const canvas = createCanvas(1100, 700);
  const ctx = canvas.getContext('2d');

  let bgLoaded = false;
  if (guildCfg.backgrounds && guildCfg.backgrounds.inventory && fs.existsSync(guildCfg.backgrounds.inventory)) {
    try {
      const bgImg = await loadImage(guildCfg.backgrounds.inventory);
      ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
      bgLoaded = true;
    } catch (e) {}
  }

  if (!bgLoaded) {
    const gradient = ctx.createLinearGradient(0, 0, 1100, 700);
    gradient.addColorStop(0, '#0a192f');
    gradient.addColorStop(1, '#004080');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1100, 700);
  }

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
  const boxWidth = 110;
  const boxHeight = 110;
  const gapX = 25;
  const gapY = 35;
  const maxCols = 7;

  for (let i = 0; i < Math.min(filteredSets.length, 28); i++) {
    const setItem = filteredSets[i];
    const col = i % maxCols;
    const row = Math.floor(i / maxCols);
    const x = startX + col * (boxWidth + gapX);
    const y = startY + row * (boxHeight + gapY);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.40)';
    ctx.strokeStyle = '#2196F3';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, boxWidth, 85, 10);
    ctx.fill();
    ctx.stroke();

    try {
      if (setItem.imagePath && fs.existsSync(setItem.imagePath)) {
        const setImg = await loadImage(setItem.imagePath);
        ctx.drawImage(setImg, x + 8, y + 8, boxWidth - 16, 69);
      }
    } catch (e) {}

    const count = userInventory[setItem.id] || 0;
    ctx.fillStyle = '#2196F3';
    ctx.beginPath();
    ctx.arc(x + boxWidth - 10, y + 10, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${count}`, x + boxWidth - 10, y + 14);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    
    let displayName = setItem.name;
    if (displayName.length > 14) {
      displayName = displayName.substring(0, 12) + '..';
    }
    ctx.fillText(displayName, x + (boxWidth / 2), y + 103);
    ctx.textAlign = 'left';
  }

  const attachment = new AttachmentBuilder(await canvas.encode('png'), { name: 'inventario.png' });

  let descText = `📦 **Inventário de <@${targetUser.id}>**\n\n`;
  if (filteredSets.length === 0) {
    descText += `*Nenhum set encontrado na categoria **${activeCategory}**.*`;
  } else {
    filteredSets.forEach(setItem => {
      const qty = userInventory[setItem.id] || 0;
      descText += `• **${setItem.name}** (${setItem.rarity}): ${qty}x\n`;
    });
  }

  const embed = new EmbedBuilder().setColor('#2196F3').setDescription(descText).setImage('attachment://inventario.png');
  const categories = ['Todas', 'Comum', 'Rara', 'Épica', 'Lendária', 'Lendária de Robux'];
  const row = new ActionRowBuilder();

  categories.slice(0, 5).forEach(cat => {
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
// GERAÇÃO DE IMAGEM ESTILO CANVA (WELCOME)
// ==========================================
async function generateWelcomeImage(member) {
  const canvas = createCanvas(1000, 400);
  const ctx = canvas.getContext('2d');

  // Fundo moderno com gradiente estilo Canva
  const gradient = ctx.createLinearGradient(0, 0, 1000, 400);
  gradient.addColorStop(0, '#1a1c29');
  gradient.addColorStop(0.5, '#2b1055');
  gradient.addColorStop(1, '#7597de');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Detalhes decorativos nas bordas
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.beginPath();
  ctx.arc(900, 50, 200, 0, Math.PI * 2);
  ctx.fill();

  // Avatar circular com borda brilhante
  try {
    const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256 });
    const avatarImg = await loadImage(avatarURL);
    
    const centerX = 200;
    const centerY = 200;
    const radius = 90;

    // Sombra do avatar
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 20;

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatarImg, centerX - radius, centerY - radius, radius * 2, radius * 2);
    ctx.restore();

    // Reset da sombra
    ctx.shadowBlur = 0;

    // Borda do avatar
    ctx.strokeStyle = '#57F287';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2, true);
    ctx.stroke();
  } catch (e) {
    console.error('Erro ao carregar avatar no Canva:', e);
  }

  // Textos estilizados
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 45px sans-serif';
  ctx.fillText('BEM-VINDO(A)!', 350, 150);

  ctx.fillStyle = '#57F287';
  ctx.font = 'bold 32px sans-serif';
  let username = member.user.username;
  if (username.length > 18) username = username.substring(0, 16) + '...';
  ctx.fillText(username, 350, 205);

  ctx.fillStyle = '#b5bac1';
  ctx.font = '22px sans-serif';
  ctx.fillText(`ID do Servidor: ${member.guild.name}`, 350, 260);

  return new AttachmentBuilder(await canvas.encode('png'), { name: 'welcome-banner.png' });
}

// ==========================================
// EVENTOS DE ENTRADA E SAÍDA (PORTÃO)
// ==========================================
client.on('guildMemberAdd', async member => {
  const guildId = member.guild.id;
  const guildCfg = getGuildConfig(guildId);
  const portao = guildCfg.portao.entrada;

  if (!portao || !portao.channelId) return;
  const channel = member.guild.channels.cache.get(portao.channelId);
  if (!channel) return;

  const rawTitle = portao.title || '👋 Novo Membro Chegou!';
  const rawDesc = portao.description || 'Seja bem-vindo(a) ao servidor, {user}!';

  const formattedTitle = rawTitle.replace(/{user}/g, member.user.username);
  const formattedDesc = rawDesc.replace(/{user}/g, `${member}`);

  const embed = new EmbedBuilder()
    .setColor(portao.color || '#57F287')
    .setTitle(formattedTitle)
    .setDescription(formattedDesc)
    .setTimestamp();

  let filesArray = [];
  
  // Gera a imagem no Canva com o avatar do membro e envia
  try {
    const bannerAttachment = await generateWelcomeImage(member);
    filesArray.push(bannerAttachment);
    embed.setImage('attachment://welcome-banner.png');
  } catch (err) {
    console.error('Erro ao gerar imagem de boas-vindas:', err);
  }

  if (portao.thumbnail && fs.existsSync(portao.thumbnail)) {
    filesArray.push(new AttachmentBuilder(portao.thumbnail, { name: 'portao-thumb.png' }));
    embed.setThumbnail('attachment://portao-thumb.png');
  }

  try {
    await channel.send({ embeds: [embed], files: filesArray });
  } catch (err) {
    console.error('Erro ao enviar mensagem de boas-vindas:', err);
  }
});

client.on('guildMemberRemove', async member => {
  const guildId = member.guild.id;
  const guildCfg = getGuildConfig(guildId);
  const portao = guildCfg.portao.saida;

  if (!portao || !portao.channelId) return;
  const channel = member.guild.channels.cache.get(portao.channelId);
  if (!channel) return;

  const rawTitle = portao.title || '🚪 Membro Saiu';
  const rawDesc = portao.description || '**{user}** saiu do servidor. Esperamos que volte logo!';

  const formattedTitle = rawTitle.replace(/{user}/g, member.user.username);
  const formattedDesc = rawDesc.replace(/{user}/g, `${member.user.username}`);

  const embed = new EmbedBuilder()
    .setColor(portao.color || '#ED4245')
    .setTitle(formattedTitle)
    .setDescription(formattedDesc)
    .setTimestamp();

  let filesArray = [];
  if (portao.thumbnail && fs.existsSync(portao.thumbnail)) {
    filesArray.push(new AttachmentBuilder(portao.thumbnail, { name: 'portao-thumb.png' }));
    embed.setThumbnail('attachment://portao-thumb.png');
  }

  try {
    await channel.send({ embeds: [embed], files: filesArray });
  } catch (err) {
    console.error('Erro ao enviar mensagem de saída:', err);
  }
});

// ==========================================
// EVENTOS DE MENSAGENS (PREFIXO ?)
// ==========================================
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  const guildId = message.guild.id;
  const guildCfg = getGuildConfig(guildId);

  if (command === 'work') {
    await handleWork(message, message.author, guildId, guildCfg);
  }

  if (command === 'saldo') {
    const target = message.mentions.users.first() || message.author;
    await handleSaldo(message, target, guildId);
  }

  if (command === 'lb') {
    await handleLeaderboard(message, message.guild);
  }

  if (command === 'set') {
    await handleSetCommand(message, message.author, guildId);
  }

  if (command === 'inventario') {
    const target = message.mentions.users.first() || message.author;
    await handleInventory(message, target, guildId, 'Todas', false);
  }
});

// ==========================================
// EVENTOS DE INTERAÇÕES (SLASH & BOTÕES)
// ==========================================
client.on('interactionCreate', async interaction => {
  if (!interaction.guild) return;
  const guildId = interaction.guild.id;
  let dbEco = loadData(ECONOMY_FILE, {});
  let guildCfg = getGuildConfig(guildId);

  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

    if (commandName === 'config') {
      const sub = interaction.options.getSubcommand();

      if (sub === 'sets') {
        const nome = interaction.options.getString('nome');
        const raridade = interaction.options.getString('raridade');
        const imagemArquivo = interaction.options.getAttachment('imagem');

        const uploadsDir = path.join(__dirname, 'uploads_sets');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

        try {
          const resImg = await fetch(imagemArquivo.url);
          const bufImg = Buffer.from(await resImg.arrayBuffer());
          const imgPath = path.join(uploadsDir, `${guildId}-${Date.now()}.png`);
          fs.writeFileSync(imgPath, bufImg);

          let guildSets = getGuildCustomSets(guildId);
          const newSet = {
            id: Date.now(),
            name: nome,
            rarity: raridade,
            imagePath: imgPath
          };

          guildSets.push(newSet);
          let allSetsDb = loadData(CUSTOM_SETS_FILE, {});
          allSetsDb[guildId] = guildSets;
          saveData(CUSTOM_SETS_FILE, allSetsDb);

          const embed = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('✅ Set Adicionado com Sucesso!')
            .setDescription(`O set **${nome}** foi cadastrado na categoria **${raridade}**!`)
            .setThumbnail(imagemArquivo.url);

          return await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (e) {
          console.error(e);
          return await interaction.reply({ content: '❌ Ocorreu um erro ao salvar a imagem do set.', ephemeral: true });
        }
      }

      if (sub === 'inventario') {
        const imagemArquivo = interaction.options.getAttachment('fundo');
        const uploadsDir = path.join(__dirname, 'uploads_bg');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

        try {
          const resBg = await fetch(imagemArquivo.url);
          const bufBg = Buffer.from(await resBg.arrayBuffer());
          const bgPath = path.join(uploadsDir, `${guildId}-inv-bg.png`);
          fs.writeFileSync(bgPath, bufBg);

          guildCfg.backgrounds.inventory = bgPath;
          let dbConfig = loadData(CONFIG_FILE, {});
          dbConfig[guildId] = guildCfg;
          saveData(CONFIG_FILE, dbConfig);

          const embed = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('✅ Fundo do Inventário Atualizado!')
            .setDescription('A nova imagem de fundo do inventário foi salva com sucesso!')
            .setImage(imagemArquivo.url);

          return await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (e) {
          return await interaction.reply({ content: '❌ Ocorreu um erro ao salvar a imagem de fundo do inventário.', ephemeral: true });
        }
      }

      if (sub === 'economia') {
        const fundoLeaderboard = interaction.options.getAttachment('fundo_leaderboard');
        const uploadsDir = path.join(__dirname, 'uploads_bg');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

        let msgContent = '⚙️ O sistema de economia está ativo e configurado com ganhos por `?work` ou `/work`.';

        if (fundoLeaderboard) {
          try {
            const resBg = await fetch(fundoLeaderboard.url);
            const bufBg = Buffer.from(await resBg.arrayBuffer());
            const bgPath = path.join(uploadsDir, `${guildId}-lb-bg.png`);
            fs.writeFileSync(bgPath, bufBg);

            guildCfg.backgrounds.leaderboard = bgPath;
            let dbConfig = loadData(CONFIG_FILE, {});
            dbConfig[guildId] = guildCfg;
            saveData(CONFIG_FILE, dbConfig);

            msgContent += '\n\n✅ **Imagem de fundo da Leaderboard atualizada com sucesso!**';
          } catch (e) {
            msgContent += '\n\n❌ Erro ao salvar a imagem de fundo da Leaderboard.';
          }
        }

        const embed = new EmbedBuilder()
          .setColor('#00FFCC')
          .setTitle('⚙️ Painel de Controle - Economia')
          .setDescription(msgContent);

        if (fundoLeaderboard) {
          embed.setImage(fundoLeaderboard.url);
        }

        return await interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (sub === 'portao') {
        const tipo = interaction.options.getString('tipo'); // 'entrada' ou 'saida'
        const canal = interaction.options.getChannel('canal');
        const tituloOpt = interaction.options.getString('titulo');
        const descOpt = interaction.options.getString('descricao');
        const corOpt = interaction.options.getString('cor');
        const miniaturaArquivo = interaction.options.getAttachment('miniatura');

        let targetCfg = guildCfg.portao[tipo];

        if (canal) targetCfg.channelId = canal.id;
        if (tituloOpt) targetCfg.title = tituloOpt;
        if (descOpt) targetCfg.description = descOpt;
        if (corOpt) targetCfg.color = corOpt;

        const uploadsDir = path.join(__dirname, 'uploads_portao');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

        if (miniaturaArquivo) {
          try {
            const resThumb = await fetch(miniaturaArquivo.url);
            const bufThumb = Buffer.from(await resThumb.arrayBuffer());
            const thumbPath = path.join(uploadsDir, `${guildId}-portao-${tipo}-thumb.png`);
            fs.writeFileSync(thumbPath, bufThumb);
            targetCfg.thumbnail = thumbPath;
          } catch (e) {}
        }

        let dbConfig = loadData(CONFIG_FILE, {});
        dbConfig[guildId] = guildCfg;
        saveData(CONFIG_FILE, dbConfig);

        const embedCfg = new EmbedBuilder()
          .setColor(targetCfg.color || '#5865F2')
          .setTitle(`✅ Configuração de Portão (${tipo.toUpperCase()}) Atualizada!`)
          .addFields(
            { name: '📢 Canal', value: targetCfg.channelId ? `<#${targetCfg.channelId}>` : '❌ Não definido', inline: true },
            { name: '🎨 Cor', value: `\`${targetCfg.color}\``, inline: true },
            { name: '📌 Título', value: `\`${targetCfg.title}\``, inline: false },
            { name: '📝 Descrição', value: `\`${targetCfg.description}\``, inline: false }
          );

        if (targetCfg.thumbnail && fs.existsSync(targetCfg.thumbnail)) {
          embedCfg.setThumbnail(miniaturaArquivo ? miniaturaArquivo.url : null);
        }

        return await interaction.reply({ embeds: [embedCfg], ephemeral: true });
      }

      if (sub === 'ticket') {
        const titulo = interaction.options.getString('titulo');
        const descricao = interaction.options.getString('descricao');
        const imagemArquivo = interaction.options.getAttachment('imagem_arquivo');
        const miniaturaArquivo = interaction.options.getAttachment('miniatura_arquivo');
        const cargoStaff = interaction.options.getRole('cargo_staff');
        const canalEnvio = interaction.options.getChannel('canal_envio');

        if (titulo) guildCfg.ticket.title = titulo;
        if (descricao) guildCfg.ticket.description = descricao;
        if (cargoStaff) guildCfg.ticket.staffRoleId = cargoStaff.id;
        if (canalEnvio) guildCfg.ticket.targetChannelId = canalEnvio.id;

        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

        if (imagemArquivo) {
          try {
            const resImg = await fetch(imagemArquivo.url);
            const bufImg = Buffer.from(await resImg.arrayBuffer());
            const imgPath = path.join(uploadsDir, `${guildId}-ticket-img-${Date.now()}.png`);
            fs.writeFileSync(imgPath, bufImg);
            guildCfg.ticket.image = imgPath;
          } catch (e) {}
        }

        if (miniaturaArquivo) {
          try {
            const resThumb = await fetch(miniaturaArquivo.url);
            const bufThumb = Buffer.from(await resThumb.arrayBuffer());
            const thumbPath = path.join(uploadsDir, `${guildId}-ticket-thumb-${Date.now()}.png`);
            fs.writeFileSync(thumbPath, bufThumb);
            guildCfg.ticket.thumbnail = thumbPath;
          } catch (e) {}
        }

        let dbConfig = loadData(CONFIG_FILE, {});
        dbConfig[guildId] = guildCfg;
        saveData(CONFIG_FILE, dbConfig);

        const embedCfg = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('✅ Configuração de Tickets Atualizada!')
          .addFields(
            { name: '📌 Título', value: `\`${guildCfg.ticket.title}\``, inline: false },
            { name: '📝 Descrição', value: `\`${guildCfg.ticket.description}\``, inline: false },
            { name: '🛡️ Cargo Staff', value: guildCfg.ticket.staffRoleId ? `<@&${guildCfg.ticket.staffRoleId}>` : '❌ Não definido', inline: true },
            { name: '📢 Canal de Envio', value: guildCfg.ticket.targetChannelId ? `<#${guildCfg.ticket.targetChannelId}>` : '❌ Não definido', inline: true }
          );

        const rowLaunch = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('cfg_ticket_enviar').setLabel('Lançar Painel Agora').setStyle(ButtonStyle.Success).setEmoji('🚀')
        );

        return await interaction.reply({ embeds: [embedCfg], components: [rowLaunch], ephemeral: true });
      }
    }

    if (commandName === 'saldo') {
      const target = interaction.options.getUser('usuario') || interaction.user;
      await handleSaldo(interaction, target, guildId);
    }

    if (commandName === 'work') {
      await handleWork(interaction, interaction.user, guildId, guildCfg);
    }

    if (commandName === 'pagar') {
      const target = interaction.options.getUser('usuario');
      const amount = interaction.options.getInteger('quantia');

      if (target.id === interaction.user.id) return await interaction.reply({ content: '❌ Você não pode pagar a si mesmo!', ephemeral: true });
      if (amount <= 0) return await interaction.reply({ content: '❌ Insira um valor válido!', ephemeral: true });

      const senderEco = getUserEco(dbEco, guildId, interaction.user.id);
      if (senderEco.wallet < amount) return await interaction.reply({ content: '❌ Você não tem saldo suficiente na carteira!', ephemeral: true });

      const targetEco = getUserEco(dbEco, guildId, target.id);
      senderEco.wallet -= amount;
      targetEco.wallet += amount;
      saveData(ECONOMY_FILE, dbEco);

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('💸 Transferência (PIX)')
        .setDescription(`Você enviou **$${amount}** para ${target}!`);

      return await interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'leaderboard') {
      await handleLeaderboard(interaction, interaction.guild);
    }

    if (commandName === 'set') {
      await handleSetCommand(interaction, interaction.user, guildId);
    }

    if (commandName === 'inventario') {
      const target = interaction.options.getUser('usuario') || interaction.user;
      await handleInventory(interaction, target, guildId, 'Todas', false);
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId.startsWith('claim_set_')) {
      const setId = parseInt(interaction.customId.split('_')[2]);
      let userSetData = getUserSets(guildId, interaction.user.id);

      if (!userSetData.pending || userSetData.pending !== setId) {
        return interaction.reply({ content: '❌ Este set não está disponível para resgate por você!', ephemeral: true });
      }

      if (!userSetData.inventory[setId]) userSetData.inventory[setId] = 0;
      userSetData.inventory[setId] += 1;
      userSetData.pending = null;
      saveUserSets(guildId, interaction.user.id, userSetData);

      const guildSets = getGuildCustomSets(guildId);
      const claimedSet = guildSets.find(s => s.id === setId);

      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('claimed').setLabel('🎁 Set Resgatado').setStyle(ButtonStyle.Secondary).setDisabled(true)
      );

      let filesArr = [];
      let thumbnailProp = null;
      if (claimedSet && fs.existsSync(claimedSet.imagePath)) {
        const fileName = path.basename(claimedSet.imagePath);
        filesArr.push(new AttachmentBuilder(claimedSet.imagePath, { name: fileName }));
        thumbnailProp = `attachment://${fileName}`;
      }

      const embed = new EmbedBuilder()
        .setColor('#2196F3')
        .setTitle('Set Resgatado com Sucesso!')
        .setDescription(`O set **${claimedSet ? claimedSet.name : 'Item'}** foi adicionado ao seu inventário!\n\n**Use \`?inventario\` ou \`/inventario\` para visualizar.**`);

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

    if (interaction.customId === 'cfg_ticket_enviar') {
      const cfg = guildCfg.ticket;
      if (!cfg.targetChannelId) return await interaction.reply({ content: '❌ Defina um canal de envio primeiro usando `/config ticket`!', ephemeral: true });
      const targetChannel = interaction.guild.channels.cache.get(cfg.targetChannelId);
      if (!targetChannel) return await interaction.reply({ content: '❌ Canal de destino não encontrado.', ephemeral: true });

      const ticketEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(cfg.title)
        .setDescription(cfg.description)
        .addFields({ name: '🎮 Jogos & Categorias', value: '• Flee The Facility\n• Murder Mystery 2\n• Piggy\n• Suporte Geral' })
        .setTimestamp()
        .setFooter({ text: 'Sistema de Tickets', iconURL: interaction.guild.iconURL() });

      let filesArray = [];
      if (cfg.image && fs.existsSync(cfg.image)) {
        filesArray.push(new AttachmentBuilder(cfg.image, { name: 'ticket-banner.png' }));
        ticketEmbed.setImage('attachment://ticket-banner.png');
      }
      if (cfg.thumbnail && fs.existsSync(cfg.thumbnail)) {
        filesArray.push(new AttachmentBuilder(cfg.thumbnail, { name: 'ticket-thumb.png' }));
        ticketEmbed.setThumbnail('attachment://ticket-thumb.png');
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('ticket_select_menu')
        .setPlaceholder('Abrir ticket')
        .addOptions([
          { label: 'Flee The Facility', value: 'ticket_ftf', emoji: '🏃‍♂️' },
          { label: 'Murder Mystery 2', value: 'ticket_mm2', emoji: '🔪' },
          { label: 'Piggy', value: 'ticket_piggy', emoji: '🐷' },
          { label: 'Suporte Geral', value: 'ticket_geral', emoji: '🎫' }
        ]);

      await targetChannel.send({ embeds: [ticketEmbed], components: [new ActionRowBuilder().addComponents(selectMenu)], files: filesArray });
      return await interaction.reply({ content: `✅ Painel de tickets enviado com sucesso para ${targetChannel}!`, ephemeral: true });
    }

    if (interaction.customId === 'claim_ticket') {
      const embed = EmbedBuilder.from(interaction.message.embeds[0])
        .addFields({ name: '🛠️ Atendido por', value: `${interaction.user}`, inline: false });
      await interaction.update({ embeds: [embed], components: [interaction.message.components[0]] });
      return await interaction.followUp({ content: `✅ ${interaction.user} assumiu este atendimento!` });
    }

    if (interaction.customId === 'close_ticket') {
      await interaction.reply({ content: '🔒 Fechando ticket em 5 segundos...' });
      setTimeout(async () => { try { await interaction.channel.delete(); } catch(e){} }, 5000);
    }
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select_menu') {
    const selectedValue = interaction.values[0];
    let categoryName = 'geral';
    if (selectedValue === 'ticket_ftf') categoryName = 'flee-the-facility';
    if (selectedValue === 'ticket_mm2') categoryName = 'murder-mystery-2';
    if (selectedValue === 'ticket_piggy') categoryName = 'piggy';
    if (selectedValue === 'ticket_geral') categoryName = 'suporte-geral';

    const guild = interaction.guild;
    const member = interaction.member;
    const cfg = guildCfg.ticket;

    await interaction.deferReply({ ephemeral: true });

    try {
      const ticketChannel = await guild.channels.create({
        name: `ticket-${member.user.username}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
          ...(cfg.staffRoleId ? [{ id: cfg.staffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : []),
          { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels] }
        ],
      });

      const ticketEmbed = new EmbedBuilder()
        .setColor('#00FFCC')
        .setTitle(`Ticket de ${member.user.username}`)
        .setDescription(`Categoria: **${categoryName.toUpperCase()}**\n\nDescreva sua dúvida ou problema detalhadamente.`)
        .setTimestamp();

      const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('claim_ticket').setLabel('Assumir Ticket').setStyle(ButtonStyle.Primary).setEmoji('🙋‍♂️'),
        new ButtonBuilder().setCustomId('close_ticket').setLabel('Fechar Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
      );

      const staffMention = cfg.staffRoleId ? `<@&${cfg.staffRoleId}>` : '*(Cargo não configurado)*';

      await ticketChannel.send({ 
        content: `${member} | ${staffMention}`, 
        embeds: [ticketEmbed], 
        components: [actionRow] 
      });

      await interaction.editReply({ content: `✅ Seu ticket foi criado com sucesso: ${ticketChannel}` });
    } catch (error) {
      console.error(error);
      await interaction.editReply({ content: '❌ Ocorreu um erro ao criar o ticket.' });
    }
  }
});

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot online!\n');
});

server.listen(process.env.PORT || 3000);
client.login(process.env.DISCORD_TOKEN);
