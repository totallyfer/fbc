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
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  AttachmentBuilder
} = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');
const http = require('http');

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
const PREFIX = '?';

function loadData(file, defaultVal = {}) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(defaultVal, null, 2));
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveData(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const commands = [
  new SlashCommandBuilder()
    .setName('config')
    .setDescription('Painel de configuração do servidor.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers | PermissionFlagsBits.Administrator)
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
    .addSubcommand(sub => sub.setName('economia').setDescription('Gerencia as configurações de economia do servidor.'))
    .addSubcommand(sub => 
      sub.setName('comp')
        .setDescription('Configura as mensagens dos comandos ?lf legit e ?lf esp.')
        .addStringOption(opt => 
          opt.setName('tipo')
            .setDescription('Selecione qual modalidade vai configurar')
            .setRequired(true)
            .addChoices(
              { name: 'LF Legit', value: 'legit' },
              { name: 'LF ESP', value: 'esp' }
            )
        )
        .addStringOption(opt => opt.setName('titulo').setDescription('Título da embed').setRequired(false))
        .addStringOption(opt => opt.setName('descricao').setDescription('Descrição da embed').setRequired(false))
        .addAttachmentOption(opt => opt.setName('imagem_arquivo').setDescription('Envie uma imagem do seu dispositivo').setRequired(false))
        .addRoleOption(opt => opt.setName('cargo1').setDescription('1º cargo a ser mencionado').setRequired(false))
        .addRoleOption(opt => opt.setName('cargo2').setDescription('2º cargo a ser mencionado').setRequired(false))
        .addRoleOption(opt => opt.setName('cargo3').setDescription('3º cargo a ser mencionado').setRequired(false))
        .addRoleOption(opt => opt.setName('cargo4').setDescription('4º cargo a ser mencionado').setRequired(false))
    ),

  new SlashCommandBuilder()
    .setName('saldo')
    .setDescription('Verifica o seu saldo ou de outro membro.')
    .addUserOption(opt => opt.setName('usuario').setDescription('Membro para ver o saldo').setRequired(false)),

  new SlashCommandBuilder()
    .setName('work')
    .setDescription('Trabalhe em sua profissão para ganhar moedas na cidade!'),

  new SlashCommandBuilder()
    .setName('pagar')
    .setDescription('Transfere moedas para outro membro.')
    .addUserOption(opt => opt.setName('usuario').setDescription('Quem vai receber').setRequired(true))
    .addIntegerOption(opt => opt.setName('quantia').setDescription('Valor a ser pago').setRequired(true)),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Mostra o ranking visual de moedas da cidade.')
].map(command => command.toJSON());

client.once('ready', async () => {
  console.log(`Bot online como ${client.user.tag}!`);
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Comandos registrados com sucesso!');
  } catch (error) {
    console.error(error);
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
      comp: {
        legit: {
          title: '🎮 Procurando Jogadores (LF LEGIT)',
          description: 'Procurando membros para jogar no modo Legit! Monte seu time agora.',
          image: '',
          roles: []
        },
        esp: {
          title: '🎯 Procurando Jogadores (LF ESP)',
          description: 'Procurando membros para jogar no modo ESP! Monte seu time agora.',
          image: '',
          roles: []
        }
      }
    };
    saveData(CONFIG_FILE, db);
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

// ==========================================
// FUNÇÕES COMPARTILHADAS
// ==========================================

async function handleWork(messageOrInteraction, user, guildId, guildCfg) {
  let dbEco = loadData(ECONOMY_FILE, {});
  const eco = getUserEco(dbEco, guildId, user.id);
  const cooldown = 30000;
  
  if (Date.now() - eco.lastWork < cooldown) {
    const timeLeft = Math.ceil((cooldown - (Date.now() - eco.lastWork)) / 1000);
    const content = `⏳ Você está descansando! Volte a trabalhar em **${timeLeft} segundos**.`;
    return messageOrInteraction.reply ? await messageOrInteraction.reply({ content }) : await messageOrInteraction.channel.send(content);
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

    ctx.fillStyle = '#111214';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const brGrad1 = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    brGrad1.addColorStop(0, 'rgba(0, 156, 59, 0.25)');
    brGrad1.addColorStop(0.5, 'rgba(255, 223, 0, 0.20)');
    brGrad1.addColorStop(1, 'rgba(0, 39, 118, 0.30)');
    ctx.fillStyle = brGrad1;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

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

    return new AttachmentBuilder(await canvas.encode('png'), { name: 'leaderboard-brasil.png' });
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

async function handleLF(message, mode, guildCfg) {
  if (!guildCfg.comp || !guildCfg.comp[mode]) return;

  const compCfg = guildCfg.comp[mode];
  const baseDesc = compCfg.description || 'Procurando membros para jogar!';
  const finalDesc = `${baseDesc}\n\n👤 **Autor:** ${message.author}`;

  const embed = new EmbedBuilder()
    .setColor(mode === 'legit' ? '#00FFCC' : '#FF0055')
    .setTitle(compCfg.title || `Procurando Jogadores (LF ${mode.toUpperCase()})`)
    .setDescription(finalDesc)
    .setFooter({ text: `Enviado por ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
    .setTimestamp();

  let filesArray = [];
  if (compCfg.image) {
    if (compCfg.image.startsWith('http')) {
      embed.setImage(compCfg.image);
    } else if (fs.existsSync(compCfg.image)) {
      const attachment = new AttachmentBuilder(compCfg.image, { name: 'lf-image.png' });
      filesArray.push(attachment);
      embed.setImage('attachment://lf-image.png');
    }
  }

  let mentions = '';
  if (compCfg.roles && compCfg.roles.length > 0) {
    mentions = compCfg.roles.map(rId => `<@&${rId}>`).join(' ');
  }

  await message.channel.send({
    content: mentions ? mentions : null,
    embeds: [embed],
    files: filesArray
  });
}

// ==========================================
// EVENTO DE MENSAGENS (COMANDOS DE PREFIXO)
// ==========================================

client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  const subCommand = args[0] ? args[0].toLowerCase() : null;
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

  if (command === 'lf') {
    if (subCommand === 'legit') {
      await handleLF(message, 'legit', guildCfg);
    } else if (subCommand === 'esp') {
      await handleLF(message, 'esp', guildCfg);
    }
  }
});

// ==========================================
// EVENTO DE INTERAÇÕES (SLASH COMMANDS)
// ==========================================

client.on('interactionCreate', async interaction => {
  if (!interaction.guild) return;
  const guildId = interaction.guild.id;
  let dbConfig = loadData(CONFIG_FILE, {});
  let dbEco = loadData(ECONOMY_FILE, {});
  let guildCfg = getGuildConfig(guildId);

  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

    if (commandName === 'config') {
      const sub = interaction.options.getSubcommand();

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
          } catch (e) {
            console.error('Erro ao salvar imagem do ticket:', e);
          }
        }

        if (miniaturaArquivo) {
          try {
            const resThumb = await fetch(miniaturaArquivo.url);
            const bufThumb = Buffer.from(await resThumb.arrayBuffer());
            const thumbPath = path.join(uploadsDir, `${guildId}-ticket-thumb-${Date.now()}.png`);
            fs.writeFileSync(thumbPath, bufThumb);
            guildCfg.ticket.thumbnail = thumbPath;
          } catch (e) {
            console.error('Erro ao salvar miniatura do ticket:', e);
          }
        }

        dbConfig[guildId] = guildCfg;
        saveData(CONFIG_FILE, dbConfig);

        const embedCfg = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('✅ Configuração de Tickets Atualizada!')
          .addFields(
            { name: '📌 Título', value: `\`${guildCfg.ticket.title}\``, inline: false },
            { name: '📝 Descrição', value: `\`${guildCfg.ticket.description}\``, inline: false },
            { name: '🛡️ Cargo Staff', value: guildCfg.ticket.staffRoleId ? `<@&${guildCfg.ticket.staffRoleId}>` : '❌ Não definido', inline: true },
            { name: '📢 Canal de Envio', value: guildCfg.ticket.targetChannelId ? `<#${guildCfg.ticket.targetChannelId}>` : '❌ Não definido', inline: true },
            { name: '🖼️ Imagem / Miniatura', value: 'Atualizadas com sucesso!', inline: true }
          );

        const rowLaunch = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('cfg_ticket_enviar').setLabel('Lançar Painel Agora').setStyle(ButtonStyle.Success).setEmoji('🚀')
        );

        return await interaction.reply({ embeds: [embedCfg], components: [rowLaunch], ephemeral: true });
      }

      if (sub === 'economia') {
        const cfg = guildCfg.economy;
        const embed = new EmbedBuilder()
          .setColor('#00FFCC')
          .setTitle('⚙️ Painel de Controle - Economia')
          .addFields(
            { name: '💵 Ganho Mínimo', value: `\`$${cfg.minWork}\``, inline: true },
            { name: '💵 Ganho Máximo', value: `\`$${cfg.maxWork}\``, inline: true }
          );

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('cfg_eco_values').setLabel('Ajustar Valores').setStyle(ButtonStyle.Primary).setEmoji('💰')
        );
        return await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      }

      if (sub === 'comp') {
        const tipo = interaction.options.getString('tipo');
        const titulo = interaction.options.getString('titulo');
        const descricao = interaction.options.getString('descricao');
        const imagemArquivo = interaction.options.getAttachment('imagem_arquivo');
        
        const cargos = [
          interaction.options.getRole('cargo1'),
          interaction.options.getRole('cargo2'),
          interaction.options.getRole('cargo3'),
          interaction.options.getRole('cargo4')
        ].filter(Boolean);

        if (!guildCfg.comp) {
          guildCfg.comp = { legit: {}, esp: {} };
        }
        if (!guildCfg.comp[tipo]) {
          guildCfg.comp[tipo] = {};
        }

        if (titulo) guildCfg.comp[tipo].title = titulo;
        if (descricao) guildCfg.comp[tipo].description = descricao;

        if (imagemArquivo) {
          const uploadsDir = path.join(__dirname, 'uploads');
          if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
          
          const filePath = path.join(uploadsDir, `${guildId}-${tipo}-${Date.now()}.png`);
          
          try {
            const response = await fetch(imagemArquivo.url);
            const buffer = Buffer.from(await response.arrayBuffer());
            fs.writeFileSync(filePath, buffer);
            guildCfg.comp[tipo].image = filePath;
          } catch (err) {
            console.error('Erro ao baixar imagem:', err);
          }
        }

        if (cargos.length > 0) {
          guildCfg.comp[tipo].roles = cargos.map(c => c.id);
        }

        dbConfig[guildId] = guildCfg;
        saveData(CONFIG_FILE, dbConfig);

        const embed = new EmbedBuilder()
          .setColor('#57F287')
          .setTitle(`✅ Configuração do ?lf ${tipo.toUpperCase()} Atualizada!`)
          .addFields(
            { name: '📌 Título Atual', value: guildCfg.comp[tipo].title || 'Padrão', inline: false },
            { name: '📝 Descrição', value: guildCfg.comp[tipo].description || 'Padrão', inline: false },
            { name: '🖼️ Imagem', value: imagemArquivo ? 'Imagem carregada com sucesso!' : 'Mantida anterior', inline: true },
            { name: '👥 Cargos Marcados', value: guildCfg.comp[tipo].roles?.length > 0 ? guildCfg.comp[tipo].roles.map(r => `<@&${r}>`).join(', ') : 'Nenhum', inline: true }
          );

        return await interaction.reply({ embeds: [embed], ephemeral: true });
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
  }

  // --- BOTÕES E CONFIGURAÇÕES DE TICKET ---
  if (interaction.isButton()) {
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
        const attImg = new AttachmentBuilder(cfg.image, { name: 'ticket-banner.png' });
        filesArray.push(attImg);
        ticketEmbed.setImage('attachment://ticket-banner.png');
      }

      if (cfg.thumbnail && fs.existsSync(cfg.thumbnail)) {
        const attThumb = new AttachmentBuilder(cfg.thumbnail, { name: 'ticket-thumb.png' });
        filesArray.push(attThumb);
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

    if (interaction.customId === 'cfg_eco_values') {
      const modal = new ModalBuilder().setCustomId('modal_eco_values').setTitle('Ajustar Valores de Trabalho');
      const minInput = new TextInputBuilder().setCustomId('eco_min').setLabel('Ganho Mínimo').setStyle(TextInputStyle.Short).setValue(String(guildCfg.economy.minWork)).setRequired(true);
      const maxInput = new TextInputBuilder().setCustomId('eco_max').setLabel('Ganho Máximo').setStyle(TextInputStyle.Short).setValue(String(guildCfg.economy.maxWork)).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(minInput), new ActionRowBuilder().addComponents(maxInput));
      return await interaction.showModal(modal);
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

  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'modal_eco_values') {
      const min = parseInt(interaction.fields.getTextInputValue('eco_min'));
      const max = parseInt(interaction.fields.getTextInputValue('eco_max'));
      if (isNaN(min) || isNaN(max) || min >= max) {
        return await interaction.reply({ content: '❌ Valores inválidos! O mínimo deve ser menor que o máximo.', ephemeral: true });
      }
      guildCfg.economy.minWork = min;
      guildCfg.economy.maxWork = max;
      dbConfig[guildId] = guildCfg;
      saveData(CONFIG_FILE, dbConfig);
      return await interaction.reply({ content: `✅ Valores de trabalho atualizados para **$${min} - $${max}**!`, ephemeral: true });
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
  res.end('Bot do Discord online e ativo!\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor web do bot rodando na porta ${PORT}`);
});

client.login(process.env.DISCORD_TOKEN);
