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

// Comandos Slash Globais
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
    .setDescription('Trabalhe para ganhar moedas na economia da cidade!'),

  new SlashCommandBuilder()
    .setName('pagar')
    .setDescription('Transfere moedas para outro membro.')
    .addUserOption(opt => opt.setName('usuario').setDescription('Quem vai receber').setRequired(true))
    .addIntegerOption(opt => opt.setName('quantia').setDescription('Valor a ser pago').setRequired(true)),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Mostra o ranking dos mais ricos da cidade em imagem.')
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

// Inicializa configurações padrão para um servidor específico
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
        minWork: 50,
        maxWork: 200
      }
    };
    saveData(CONFIG_FILE, db);
  }
  return db[guildId];
}

function getUserEco(dbEco, guildId, userId) {
  if (!dbEco[guildId]) dbEco[guildId] = {};
  if (!dbEco[guildId][userId]) {
    dbEco[guildId][userId] = { wallet: 100, bank: 500, lastWork: 0 };
  }
  return dbEco[guildId][userId];
}

client.on('interactionCreate', async interaction => {
  const guildId = interaction.guild.id;
  let dbConfig = loadData(CONFIG_FILE, {});
  let dbEco = loadData(ECONOMY_FILE, {});
  let guildCfg = getGuildConfig(guildId);

  // --- INTERAÇÕES DE COMANDOS SLASH ---
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

    if (commandName === 'config') {
      const sub = interaction.options.getSubcommand();

      // PAINEL DE CONFIGURAÇÃO DE TICKET
      if (sub === 'ticket') {
        const cfg = guildCfg.ticket;
        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('⚙️ Painel de Controle - Tickets')
          .setDescription('Gerencie as configurações de atendimento deste servidor:')
          .addFields(
            { name: '📌 Cargo Staff', value: cfg.staffRoleId ? `<@&${cfg.staffRoleId}>` : '❌ Não definido', inline: true },
            { name: '📢 Canal do Painel', value: cfg.targetChannelId ? `<#${cfg.targetChannelId}>` : '❌ Não definido', inline: true },
            { name: '📝 Título Atual', value: `\`${cfg.title}\``, inline: false }
          );

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('cfg_ticket_embed').setLabel('Editar Embed').setStyle(ButtonStyle.Primary).setEmoji('✏️'),
          new ButtonBuilder().setCustomId('cfg_ticket_cargo').setLabel('Cargo Staff').setStyle(ButtonStyle.Secondary).setEmoji('🛡️'),
          new ButtonBuilder().setCustomId('cfg_ticket_canal').setLabel('Canal de Envio').setStyle(ButtonStyle.Secondary).setEmoji('📺'),
          new ButtonBuilder().setCustomId('cfg_ticket_enviar').setLabel('Lançar Painel').setStyle(ButtonStyle.Success).setEmoji('🚀')
        );
        return await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      }

      // PAINEL DE CONFIGURAÇÃO DE ECONOMIA
      if (sub === 'economia') {
        const cfg = guildCfg.economy;
        const embed = new EmbedBuilder()
          .setColor('#00FFCC')
          .setTitle('⚙️ Painel de Controle - Economia')
          .setDescription('Gerencie os valores de ganho do trabalho neste servidor:')
          .addFields(
            { name: '💵 Ganho Mínimo (/trabalhar)', value: `\`$${cfg.minWork}\``, inline: true },
            { name: '💵 Ganho Máximo (/trabalhar)', value: `\`$${cfg.maxWork}\``, inline: true }
          );

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('cfg_eco_values').setLabel('Ajustar Valores de Trabalho').setStyle(ButtonStyle.Primary).setEmoji('💰')
        );
        return await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      }
    }

    if (commandName === 'saldo') {
      const target = interaction.options.getUser('usuario') || interaction.user;
      const eco = getUserEco(dbEco, guildId, target.id);
      saveData(ECONOMY_FILE, dbEco);

      const embed = new EmbedBuilder()
        .setColor('#00FFCC')
        .setTitle(`💰 Carteira de ${target.username}`)
        .addFields(
          { name: '💵 Carteira', value: `\`$${eco.wallet}\``, inline: true },
          { name: '🏦 Banco', value: `\`$${eco.bank}\``, inline: true }
        )
        .setThumbnail(target.displayAvatarURL());
      return await interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'trabalhar') {
      const eco = getUserEco(dbEco, guildId, interaction.user.id);
      const cooldown = 30000; // 30 segundos
      if (Date.now() - eco.lastWork < cooldown) {
        const timeLeft = Math.ceil((cooldown - (Date.now() - eco.lastWork)) / 1000);
        return await interaction.reply({ content: `⏳ Você está cansado! Trabalhe novamente em **${timeLeft} segundos**.` });
      }

      const min = guildCfg.economy.minWork;
      const max = guildCfg.economy.maxWork;
      const earnings = Math.floor(Math.random() * (max - min + 1)) + min;

      eco.wallet += earnings;
      eco.lastWork = Date.now();
      saveData(ECONOMY_FILE, dbEco);

      return await interaction.reply({ content: `💼 Você trabalhou duro e ganhou **$${earnings}**!` });
    }

    if (commandName === 'pagar') {
      const target = interaction.options.getUser('usuario');
      const amount = interaction.options.getInteger('quantia');

      if (target.id === interaction.user.id) return await interaction.reply({ content: '❌ Você não pode pagar a si mesmo!', ephemeral: true });
      if (amount <= 0) return await interaction.reply({ content: '❌ Insira um valor válido!', ephemeral: true });

      const senderEco = getUserEco(dbEco, guildId, interaction.user.id);
      if (senderEco.wallet < amount) return await interaction.reply({ content: '❌ Você não tem dinheiro suficiente na carteira!', ephemeral: true });

      const targetEco = getUserEco(dbEco, guildId, target.id);
      senderEco.wallet -= amount;
      targetEco.wallet += amount;
      saveData(ECONOMY_FILE, dbEco);

      return await interaction.reply({ content: `💸 Você transferiu com sucesso **$${amount}** para ${target}!` });
    }

    if (commandName === 'leaderboard') {
      const guildEconomy = dbEco[guildId] || {};
      const sortedUsers = Object.entries(guildEconomy)
        .map(([userId, data]) => ({ userId, total: data.wallet + data.bank }))
        .sort((a, b) => b.total - a.total);

      if (sortedUsers.length === 0) return await interaction.reply({ content: '❌ Nenhum registro de economia neste servidor ainda.' });

      async function generateLeaderboardImage(page) {
        const canvas = createCanvas(700, 600);
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#1e1e2f';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 30px sans-serif';
        ctx.fillText('🏆 Ranking Econômico do Servidor', 35, 50);

        const start = page * 10;
        const currentSlice = sortedUsers.slice(start, start + 10);

        let y = 90;
        for (let i = 0; i < currentSlice.length; i++) {
          const entry = currentSlice[i];
          const rank = start + i + 1;
          let member;
          try {
            member = await interaction.guild.members.fetch(entry.userId);
          } catch {
            member = { user: { username: 'Membro Desconhecido' }, displayAvatarURL: () => 'https://cdn.discord-icons.com/default.png' };
          }

          ctx.fillStyle = '#2d2d44';
          ctx.beginPath();
          ctx.roundRect(30, y, 640, 45, 10);
          ctx.fill();

          ctx.fillStyle = rank === 1 ? '#ffd700' : rank === 2 ? '#c0c0c0' : rank === 3 ? '#cd7f32' : '#ffffff';
          ctx.font = 'bold 20px sans-serif';
          ctx.fillText(`#${rank}`, 50, y + 28);

          try {
            const avatarImg = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 128 }));
            ctx.save();
            ctx.beginPath();
            ctx.arc(115, y + 22.5, 18, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatarImg, 97, y + 4.5, 36, 36);
            ctx.restore();
          } catch (e) {}

          ctx.fillStyle = '#ffffff';
          ctx.font = '18px sans-serif';
          ctx.fillText(member.user.username, 150, y + 28);

          ctx.fillStyle = '#00ffcc';
          ctx.font = 'bold 18px sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(`$${entry.total}`, 650, y + 28);
          ctx.textAlign = 'left';

          y += 52;
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

  // --- INTERAÇÕES DE BOTÕES E MODAIS DE CONFIGURAÇÃO ---
  if (interaction.isButton()) {
    if (interaction.customId === 'cfg_ticket_embed') {
      const modal = new ModalBuilder().setCustomId('modal_ticket_embed').setTitle('Personalizar Embed do Ticket');
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
        .setPlaceholder('Escolha o assunto...')
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

  // --- SALVAR MODAIS ---
  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'modal_ticket_embed') {
      guildCfg.ticket.title = interaction.fields.getTextInputValue('embed_title');
      guildCfg.ticket.description = interaction.fields.getTextInputValue('embed_desc');
      dbConfig[guildId] = guildCfg;
      saveData(CONFIG_FILE, dbConfig);
      return await interaction.reply({ content: '✅ Embed do ticket atualizada com sucesso!', ephemeral: true });
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

  // --- SALVAR MENUS DE CONFIGURAÇÃO ---
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

  // --- CRIAÇÃO DO TICKET PELO USUÁRIO ---
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

client.login(process.env.DISCORD_TOKEN);
