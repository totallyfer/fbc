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
// BASE DE DADOS DOS SETS (COM CAMINHOS LOCAIS DO RENDER)
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
    .setDescription('Mostra o ranking visual de moedas da cidade.'),

  new SlashCommandBuilder()
    .setName('set')
    .setDescription('Sorteie um set de Flee the Facility!'),

  new SlashCommandBuilder()
    .setName('inventario')
    .setDescription('Visualiza o inventário de sets de um usuário.')
    .addUserOption(opt => opt.setName('usuario').setDescription('Membro para ver o inventário').setRequired(false))
].map(command => command.toJSON());

client.once('ready', async () => {
  console.log(`🤖 Bot online como ${client.user.tag}!`);
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ Comandos Slash registrados com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao registrar comandos Slash:', error);
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

function getUserSets(guildId, userId) {
  let dbSets = loadData(SETS_FILE, {});
  if (!dbSets[guildId]) dbSets[guildId] = {};
  if (!dbSets[guildId][userId]) {
    dbSets[guildId][userId] = { pending: null, cooldown: 0, inventory: {} };
  }
  return dbSets[guildId][userId];
}

// ==========================================
// FUNÇÕES DOS COMANDOS
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

async function handleSetCommand(messageOrInteraction, user, guildId) {
  let dbSets = loadData(SETS_FILE, {});
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
  let selectedRarity = 'Rara';
  if (randomChance >= 61 && randomChance < 86) selectedRarity = 'Épica';
  else if (randomChance >= 86 && randomChance < 96) selectedRarity = 'Lendária';
  else if (randomChance >= 96) selectedRarity = 'Lendária de Robux';

  const filteredSets = SETS.filter(s => s.rarity === selectedRarity);
  const pendingSet = filteredSets[Math.floor(Math.random() * filteredSets.length)];

  userSetData.pending = pendingSet.id;
  userSetData.cooldown = now;
  dbSets[guildId][user.id] = userSetData;
  saveData(SETS_FILE, dbSets);

  // Se o arquivo local existir, envia como anexo para o embed
  let filesArr = [];
  let imageEmbedProp = null;
  if (fs.existsSync(pendingSet.image)) {
    const fileName = path.basename(pendingSet.image);
    filesArr.push(new AttachmentBuilder(pendingSet.image, { name: fileName }));
    imageEmbedProp = `attachment://${fileName}`;
  }

  const embed = new EmbedBuilder()
    .setColor('#2196F3')
    .setTitle('🎉 Você ganhou um Set!')
    .setDescription(`## ${pendingSet.name}\n\nClique no botão abaixo para resgatar seu set para o seu inventário!`);

  if (imageEmbedProp) embed.setImage(imageEmbedProp);

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

async function handleInventory(messageOrInteraction, targetUser, guildId, activeCategory = 'Todas', isUpdate = false) {
  let dbSets = loadData(SETS_FILE, {});
  const userSetData = (dbSets[guildId] && dbSets[guildId][targetUser.id]) ? dbSets[guildId][targetUser.id] : { inventory: {} };
  const userInventory = userSetData.inventory || {};

  const userOwnedSets = SETS.filter(s => (userInventory[s.id] || 0) > 0);
  const filteredSets = activeCategory === 'Todas' 
    ? userOwnedSets 
    : userOwnedSets.filter(s => s.rarity === activeCategory);

  // Criar tela do Canvas
  const canvas = createCanvas(1000, 500);
  const ctx = canvas.getContext('2d');

  // Gradiente de Fundo
  const gradient = ctx.createLinearGradient(0, 0, 1000, 500);
  gradient.addColorStop(0, '#0a192f');
  gradient.addColorStop(1, '#004080');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1000, 500);

  // Avatar do Utilizador
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
  } catch (err) {
    console.error('Erro ao renderizar avatar:', err);
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText(targetUser.username, 180, 90);

  ctx.fillStyle = '#2196F3';
  ctx.font = '20px sans-serif';
  ctx.fillText(`Categoria: ${activeCategory} (${filteredSets.length} Sets)`, 180, 125);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(40, 180);
  ctx.lineTo(960, 180);
  ctx.stroke();

  // Grade de Miniaturas com Caminhos Locais Seguros
  const startX = 50;
  const startY = 200;
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
      } else {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '10px sans-serif';
        ctx.fillText("Sem Ficheiro", x + 10, y + 45);
      }
    } catch (e) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '10px sans-serif';
      ctx.fillText("Erro Img", x + 15, y + 45);
    }

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

  const embed = new EmbedBuilder()
    .setColor('#2196F3')
    .setDescription(descText)
    .setImage('attachment://inventario.png');

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

  if (isUpdate) {
    return await messageOrInteraction.update(replyData);
  } else if (messageOrInteraction.reply) {
    return await messageOrInteraction.reply(replyData);
  } else {
    return await messageOrInteraction.channel.send(replyData);
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
// EVENTO DE MENSAGENS (PREFIXO ?)
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

  if (command === 'set') {
    await handleSetCommand(message, message.author, guildId);
  }

  if (command === 'inventario') {
    const target = message.mentions.users.first() || message.author;
    await handleInventory(message, target, guildId, 'Todas', false);
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
// EVENTO DE INTERAÇÕES (SLASH COMMANDS E BOTÕES)
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

        if (!guildCfg.comp) guildCfg.comp = { legit: {}, esp: {} };
        if (!guildCfg.comp[tipo]) guildCfg.comp[tipo] = {};

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
          } catch (err) {}
        }

        if (cargos.length > 0) guildCfg.comp[tipo].roles = cargos.map(c => c.id);

        dbConfig[guildId] = guildCfg;
        saveData(CONFIG_FILE, dbConfig);

        const embed = new EmbedBuilder()
          .setColor('#57F287')
          .setTitle(`✅ Configuração do ?lf ${tipo.toUpperCase()} Atualizada!`);

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

    if (commandName === 'set') {
      await handleSetCommand(interaction, interaction.user, guildId);
    }

    if (commandName === 'inventario') {
      const target = interaction.options.getUser('usuario') || interaction.user;
      await handleInventory(interaction, target, guildId, 'Todas', false);
    }
  }

  if (interaction.isButton()) {
    // Resgatar Set
    if (interaction.customId.startsWith('claim_set_')) {
      const setId = parseInt(interaction.customId.split('_')[2]);
      let dbSets = loadData(SETS_FILE, {});
      const userSetData = getUserSets(guildId, interaction.user.id);

      if (!userSetData.pending || userSetData.pending !== setId) {
        return interaction.reply({ content: '❌ Este set não está disponível para resgate por você!', ephemeral: true });
      }

      if (!userSetData.inventory[setId]) userSetData.inventory[setId] = 0;
      userSetData.inventory[setId] += 1;
      userSetData.pending = null;
      dbSets[guildId][interaction.user.id] = userSetData;
      saveData(SETS_FILE, dbSets);

      const claimedSet = SETS.find(s => s.id === setId);

      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('claimed').setLabel('🎁 Set Resgatado').setStyle(ButtonStyle.Secondary).setDisabled(true)
      );

      let filesArr = [];
      let imageEmbedProp = null;
      if (fs.existsSync(claimedSet.image)) {
        const fileName = path.basename(claimedSet.image);
        filesArr.push(new AttachmentBuilder(claimedSet.image, { name: fileName }));
        imageEmbedProp = `attachment://${fileName}`;
      }

      const embed = new EmbedBuilder()
        .setColor('#2196F3')
        .setTitle('Set Resgatado!')
        .setDescription(`O set **${claimedSet.name}** foi adicionado ao seu inventário!\n\n**Use ?inventario ou /inventario para visualizar seu inv**`);

      if (imageEmbedProp) embed.setThumbnail(imageEmbedProp);

      return await interaction.update({ embeds: [embed], components: [disabledRow], files: filesArr });
    }

    // Navegar Categorias do Inventário
    if (interaction.customId.startsWith('inv_cat_')) {
      const [, , targetId, category] = interaction.customId.split('_');
      if (interaction.user.id !== targetId) {
        return interaction.reply({ content: '❌ Você não pode alterar a visualização do inventário de outra pessoa.', ephemeral: true });
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

  if (interaction.isModalSubmit() && interaction.customId === 'modal_eco_values') {
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

  if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select_menu') {
    const selectedValue = interaction.values[0];
    let categoryName = 'geral';
    if (selectedValue === 'ticket_ftf') categoryName = 'flee-the-facility';
    if (selectedValue === 'ticket_mm2') categoryName = 'murder-mystery-2';
    if (selectedValue === 'ticket_piggy') categoryName, categoryName = 'piggy';
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
      await interaction.editReply({ content: '❌ Ocorreu um erro ao criar o ticket. Verifique as permissões do bot.' });
    }
  }
});

// Servidor Web HTTP para o Render manter o bot ativo
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot do Discord online e ativo!\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🌐 Servidor HTTP ativo na porta ${PORT}`);
});

client.login(process.env.DISCORD_TOKEN);
