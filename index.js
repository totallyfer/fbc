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
    .addSubcommand(sub => sub.setName('ticket').setDescription('Gerencia o sistema de tickets do servidor.'))
    .addSubcommand(sub => sub.setName('economia').setDescription('Gerencia as configurações de economia do servidor.')),

  new SlashCommandBuilder()
    .setName('saldo')
    .setDescription('Verifica o seu saldo ou de outro membro.')
    .addUserOption(opt => opt.setName('usuario').setDescription('Membro para ver o saldo').setRequired(false)),

  new SlashCommandBuilder()
    .setName('trabalhar')
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
        staffRoleId: null,
        targetChannelId: null
      },
      economy: {
        minWork: 80,
        maxWork: 250
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

client.on('interactionCreate', async interaction => {
  const guildId = interaction.guild.id;
  let dbConfig = loadData(CONFIG_FILE, {});
  let dbEco = loadData(ECONOMY_FILE, {});
  let guildCfg = getGuildConfig(guildId);

  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

    if (commandName === 'config') {
      const sub = interaction.options.getSubcommand();
      if (sub === 'ticket') {
        const cfg = guildCfg.ticket;
        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('⚙️ Painel de Controle - Tickets')
          .addFields(
            { name: '📌 Cargo Staff', value: cfg.staffRoleId ? `<@&${cfg.staffRoleId}>` : '❌ Não definido', inline: true },
            { name: '📢 Canal', value: cfg.targetChannelId ? `<#${cfg.targetChannelId}>` : '❌ Não definido', inline: true },
            { name: '📝 Título', value: `\`${cfg.title}\``, inline: false }
          );

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('cfg_ticket_embed').setLabel('Editar Embed').setStyle(ButtonStyle.Primary).setEmoji('✏️'),
          new ButtonBuilder().setCustomId('cfg_ticket_cargo').setLabel('Cargo Staff').setStyle(ButtonStyle.Secondary).setEmoji('🛡️'),
          new ButtonBuilder().setCustomId('cfg_ticket_canal').setLabel('Canal').setStyle(ButtonStyle.Secondary).setEmoji('📺'),
          new ButtonBuilder().setCustomId('cfg_ticket_enviar').setLabel('Lançar Painel').setStyle(ButtonStyle.Success).setEmoji('🚀')
        );
        return await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
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
    }

    if (commandName === 'saldo') {
      const target = interaction.options.getUser('usuario') || interaction.user;
      const eco = getUserEco(dbEco, guildId, target.id);
      saveData(ECONOMY_FILE, dbEco);

      const total = eco.wallet + eco.bank;

      const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setAuthor({ name: `Extrato Bancário • ${target.username}`, iconURL: target.displayAvatarURL() })
        .setDescription(`Detalhes financeiros da conta de ${target}.`)
        .addFields(
          { name: '💵 Carteira', value: `\`$${eco.wallet.toLocaleString()}\``, inline: true },
          { name: '🏦 Banco', value: `\`$${eco.bank.toLocaleString()}\``, inline: true },
          { name: '💎 Patrimônio Total', value: `\`$${total.toLocaleString()}\``, inline: false }
        )
        .setThumbnail(target.displayAvatarURL({ size: 256 }))
        .setFooter({ text: 'Sistema Financeiro da Cidade', iconURL: interaction.guild.iconURL() })
        .setTimestamp();

      return await interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'trabalhar') {
      const eco = getUserEco(dbEco, guildId, interaction.user.id);
      const cooldown = 30000;
      if (Date.now() - eco.lastWork < cooldown) {
        const timeLeft = Math.ceil((cooldown - (Date.now() - eco.lastWork)) / 1000);
        return await interaction.reply({ content: `⏳ Você está descansando! Volte a trabalhar em **${timeLeft} segundos**.` });
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

      return await interaction.reply({ embeds: [embed] });
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
      const guildEconomy = dbEco[guildId] || {};
      const sortedUsers = Object.entries(guildEconomy)
        .map(([userId, data]) => ({ userId, total: data.wallet + data.bank, wallet: data.wallet, bank: data.bank }))
        .sort((a, b) => b.total - a.total);

      if (sortedUsers.length === 0) return await interaction.reply({ content: '❌ Ainda não há registros na economia deste servidor.' });

      async function generateLeaderboardImage(page) {
        const canvas = createCanvas(900, 750);
        const ctx = canvas.getContext('2d');

        // Fundo com tom escuro elegante idêntico ao modelo
        ctx.fillStyle = '#17181c';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Faixa de fundo decorativa superior
        ctx.fillStyle = '#1f2024';
        ctx.fillRect(0, 0, canvas.width, 110);

        // Nome do Servidor no Topo
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 26px sans-serif';
        ctx.fillText(interaction.guild.name, 45, 65);

        // Ícone/Logo do Servidor no canto superior direito (se houver)
        try {
          if (interaction.guild.iconURL()) {
            const guildIcon = await loadImage(interaction.guild.iconURL({ extension: 'png', size: 128 }));
            ctx.save();
            ctx.beginPath();
            ctx.arc(835, 55, 30, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(guildIcon, 805, 25, 60, 60);
            ctx.restore();
          }
        } catch (e) {}

        const start = page * 10;
        const currentSlice = sortedUsers.slice(start, start + 10);

        let y = 135;
        for (let i = 0; i < currentSlice.length; i++) {
          const entry = currentSlice[i];
          const rank = start + i + 1;
          let member;
          try {
            member = await interaction.guild.members.fetch(entry.userId);
          } catch {
            member = { user: { username: 'Membro Desconhecido', id: entry.userId }, displayAvatarURL: () => 'https://cdn.discord-icons.com/default.png' };
          }

          // Bloco do Cartão do Usuário
          ctx.fillStyle = '#222327';
          ctx.beginPath();
          ctx.roundRect(40, y, 820, 56, 10);
          ctx.fill();

          // Avatar circular à esquerda
          try {
            const avatarImg = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 128 }));
            ctx.save();
            ctx.beginPath();
            ctx.arc(78, y + 28, 22, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatarImg, 56, y + 6, 44, 44);
            ctx.restore();
          } catch (e) {}

          // Posição e Nome (#1 Nome do Usuário)
          ctx.fillStyle = rank === 1 ? '#fEE75C' : rank === 2 ? '#BCC0C4' : rank === 3 ? '#EB459E' : '#ffffff';
          ctx.font = 'bold 20px sans-serif';
          ctx.fillText(`#${rank} ${member.user.username}`, 120, y + 26);

          // ID do Usuário logo abaixo
          ctx.fillStyle = '#949ba4';
          ctx.font = '14px sans-serif';
          ctx.fillText(`ID: ${member.userId}`, 120, y + 46);

          // Saldo Total de Moedas (À direita)
          ctx.fillStyle = '#57F287';
          ctx.font = 'bold 20px sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(`$${entry.total.toLocaleString()}`, 835, y + 36);
          ctx.textAlign = 'left';

          y += 66;
        }

        return new AttachmentBuilder(await canvas.encode('png'), { name: 'leaderboard-moedas.png' });
      }

      let currentPage = 0;
      const maxPages = Math.ceil(sortedUsers.length / 10) - 1;

      const attachment = await generateLeaderboardImage(currentPage);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('lb_prev').setLabel('◀ Anterior').setStyle(ButtonStyle.Primary).setDisabled(currentPage === 0),
        new ButtonBuilder().setCustomId('lb_next').setLabel('Próxima ▶').setStyle(ButtonStyle.Primary).setDisabled(currentPage >= maxPages)
      );

      const msg = await interaction.reply({ files: [attachment], components: [row], fetchReply: true });

      const collector = msg.createMessageComponentCollector({ time: 60000 });
      collector.on('collect', async i => {
        if (i.user.id !== interaction.user.id) return i.reply({ content: '❌ Você não pode controlar este painel!', ephemeral: true });

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
  }

  // --- BOTÕES E CONFIGURAÇÕES DE TICKET ---
  if (interaction.isButton()) {
    if (interaction.customId === 'cfg_ticket_embed') {
      const modal = new ModalBuilder().setCustomId('modal_ticket_embed').setTitle('Personalizar Embed');
      const titleInput = new TextInputBuilder().setCustomId('embed_title').setLabel('Título').setStyle(TextInputStyle.Short).setValue(guildCfg.ticket.title).setRequired(true);
      const descInput = new TextInputBuilder().setCustomId('embed_desc').setLabel('Descrição').setStyle(TextInputStyle.Paragraph).setValue(guildCfg.ticket.description).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(titleInput), new ActionRowBuilder().addComponents(descInput));
      return await interaction.showModal(modal);
    }

    if (interaction.customId === 'cfg_ticket_cargo') {
      const row = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('select_role_staff').setPlaceholder('Cargo de staff...'));
      return await interaction.reply({ content: 'Selecione o cargo:', components: [row], ephemeral: true });
    }

    if (interaction.customId === 'cfg_ticket_canal') {
      const row = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('select_channel_target').setChannelTypes([ChannelType.GuildText]).setPlaceholder('Canal...'));
      return await interaction.reply({ content: 'Selecione o canal de destino:', components: [row], ephemeral: true });
    }

    if (interaction.customId === 'cfg_ticket_enviar') {
      const cfg = guildCfg.ticket;
      if (!cfg.targetChannelId) return await interaction.reply({ content: '❌ Defina um canal de envio primeiro!', ephemeral: true });
      const targetChannel = interaction.guild.channels.cache.get(cfg.targetChannelId);
      if (!targetChannel) return await interaction.reply({ content: '❌ Canal não encontrado.', ephemeral: true });

      const ticketEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(cfg.title)
        .setDescription(cfg.description)
        .addFields({ name: '🎮 Jogos & Categorias', value: '• Flee The Facility\n• Murder Mystery 2\n• Piggy\n• Suporte Geral' })
        .setTimestamp()
        .setFooter({ text: 'Sistema de Tickets', iconURL: interaction.guild.iconURL() });

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('ticket_select_menu')
        .setPlaceholder('Abrir ticket')
        .addOptions([
          { label: 'Flee The Facility', value: 'ticket_ftf', emoji: '🏃‍♂️' },
          { label: 'Murder Mystery 2', value: 'ticket_mm2', emoji: '🔪' },
          { label: 'Piggy', value: 'ticket_piggy', emoji: '🐷' },
          { label: 'Suporte Geral', value: 'ticket_geral', emoji: '🎫' }
        ]);

      await targetChannel.send({ embeds: [ticketEmbed], components: [new ActionRowBuilder().addComponents(selectMenu)] });
      return await interaction.reply({ content: `✅ Painel enviado para ${targetChannel}!`, ephemeral: true });
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
    if (interaction.customId === 'modal_ticket_embed') {
      guildCfg.ticket.title = interaction.fields.getTextInputValue('embed_title');
      guildCfg.ticket.description = interaction.fields.getTextInputValue('embed_desc');
      dbConfig[guildId] = guildCfg;
      saveData(CONFIG_FILE, dbConfig);
      return await interaction.reply({ content: '✅ Embed atualizada com sucesso!', ephemeral: true });
    }

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

  if (interaction.isRoleSelectMenu() && interaction.customId === 'select_role_staff') {
    guildCfg.ticket.staffRoleId = interaction.values[0];
    dbConfig[guildId] = guildCfg;
    saveData(CONFIG_FILE, dbConfig);
    return await interaction.update({ content: `✅ Cargo de staff definido para <@&${guildCfg.ticket.staffRoleId}>!`, components: [] });
  }

  if (interaction.isChannelSelectMenu() && interaction.customId === 'select_channel_target') {
    guildCfg.ticket.targetChannelId = interaction.values[0];
    dbConfig[guildId] = guildCfg;
    saveData(CONFIG_FILE, dbConfig);
    return await interaction.update({ content: `✅ Canal de envio definido para <#${guildCfg.ticket.targetChannelId}>!`, components: [] });
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
