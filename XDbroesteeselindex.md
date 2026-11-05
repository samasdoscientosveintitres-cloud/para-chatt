**require('dotenv').config();**

**// ================= SAE LIVE RADAR INTEGRATION =================**



**const SAE\_RADAR\_CHANNEL\_ID = "1546328271686471770";**



**const SAE\_RADAR\_PETS = \[**

&#x20; **{ name: "Royal SkyWhale", aliases: \["royal skywhale", "royal sky whale", "skywhale"] },**

&#x20; **{ name: "Celestial Sunlion", aliases: \["celestial sunlion"] },**

&#x20; **{ name: "Skeleton Horse", aliases: \["skeleton horse"] },**

&#x20; **{ name: "Gorilla King", aliases: \["gorilla king"] },**

&#x20; **{ name: "World Burner", aliases: \["world burner", "worldburner"] },**

&#x20; **{ name: "NightFlame", aliases: \["nightflame", "night flame"] },**

&#x20; **{ name: "Oni Tiger", aliases: \["oni tiger"] },**

&#x20; **{ name: "ArchAngel", aliases: \["archangel"] },**

&#x20; **{ name: "Pegasus", aliases: \["pegasus"] },**

&#x20; **{ name: "Unicorn", aliases: \["unicorn", "unicornio"] },**

&#x20; **{ name: "Kitsune", aliases: \["kitsune"] }**

**];**



**function saeRadarNormalize(value) {**

&#x20; **return String(value || "")**

&#x20;   **.normalize("NFKD")**

&#x20;   **.replace(/\[\\u0300-\\u036f]/g, "")**

&#x20;   **.replace(/\\s+/g, " ")**

&#x20;   **.trim()**

&#x20;   **.toLowerCase();**

**}**



**function saeRadarDetectPets(content) {**

&#x20; **const text = saeRadarNormalize(content);**



&#x20; **if (!/\\bspawned\\b/i.test(text)) return \[];**



&#x20; **return SAE\_RADAR\_PETS**

&#x20;   **.filter(pet => pet.aliases.some(alias => {**

&#x20;     **const escaped = saeRadarNormalize(alias)**

&#x20;       **.replace(/\[.\*+?^${}()|\[\\]\\\\]/g, "\\\\$\&")**

&#x20;       **.replace(/\\s+/g, "\\\\s+");**



&#x20;     **return new RegExp(**

&#x20;       **`(?:^|\[^a-z0-9])${escaped}(?:$|\[^a-z0-9])`,**

&#x20;       **"i"**

&#x20;     **).test(text);**

&#x20;   **}))**

&#x20;   **.map(pet => pet.name);**

**}**



**async function forwardRadarDetection(message) {**

&#x20; **try {**

&#x20;   **if (**

&#x20;     **!message ||**

&#x20;     **String(message.channelId) !== SAE\_RADAR\_CHANNEL\_ID ||**

&#x20;     **!message.author?.bot**

&#x20;   **) return;**



&#x20;   **const pets = saeRadarDetectPets(message.content || "");**

&#x20;   **if (!pets.length) return;**



&#x20;   **const baseUrl = String(process.env.RADAR\_INGEST\_URL || "").replace(/\\/+$/, "");**

&#x20;   **const token = String(process.env.RADAR\_INGEST\_TOKEN || "");**



&#x20;   **if (!baseUrl || !token) {**

&#x20;     **console.error("SAE RADAR: faltan las variables de conexión.");**

&#x20;     **return;**

&#x20;   **}**



&#x20;   **const response = await fetch(`${baseUrl}/api/events`, {**

&#x20;     **method: "POST",**

&#x20;     **headers: {**

&#x20;       **"Content-Type": "application/json",**

&#x20;       **"Authorization": `Bearer ${token}`**

&#x20;     **},**

&#x20;     **body: JSON.stringify({**

&#x20;       **pets,**

&#x20;       **sourceChannelId: SAE\_RADAR\_CHANNEL\_ID,**

&#x20;       **sourceMessageId: String(message.id || "")**

&#x20;     **}),**

&#x20;     **signal: AbortSignal.timeout(70000)**

&#x20;   **});**



&#x20;   **const result = await response.json().catch(() => ({}));**



&#x20;   **if (!response.ok) {**

&#x20;     **console.error(`SAE RADAR: error HTTP ${response.status}`);**

&#x20;     **return;**

&#x20;   **}**



&#x20;   **console.log(**

&#x20;     **`SAE RADAR: detección enviada: ${pets.join(" + ")}`,**

&#x20;     **result.duplicate ? "(ya registrada)" : ""**

&#x20;   **);**



&#x20; **} catch (error) {**

&#x20;   **console.error("SAE RADAR:", error.message);**

&#x20; **}**

**}**



**function startRadarKeepAlive() {**

&#x20; **const baseUrl = String(process.env.RADAR\_INGEST\_URL || "").replace(/\\/+$/, "");**

&#x20; **if (!baseUrl) return;**



&#x20; **const ping = async () => {**

&#x20;   **try {**

&#x20;     **await fetch(`${baseUrl}/health`, {**

&#x20;       **signal: AbortSignal.timeout(70000),**

&#x20;       **cache: "no-store"**

&#x20;     **});**

&#x20;   **} catch (error) {**

&#x20;     **console.warn("SAE RADAR keep-alive:", error.message);**

&#x20;   **}**

&#x20; **};**



&#x20; **void ping();**



&#x20; **const timer = setInterval(() => {**

&#x20;   **void ping();**

&#x20; **}, 10 \* 60 \* 1000);**



&#x20; **timer.unref?.();**

**}**



**// ================= END SAE LIVE RADAR INTEGRATION =================**

**const fs = require('node:fs');**

**const path = require('node:path');**

**const cron = require('node-cron');**

**const { DateTime } = require('luxon');**

**const {**

&#x20; **Client,**

&#x20; **GatewayIntentBits,**

&#x20; **Partials,**

&#x20; **EmbedBuilder,**

&#x20; **Events,**

&#x20; **ActivityType,**

&#x20; **REST,**

&#x20; **Routes,**

&#x20; **SlashCommandBuilder,**

&#x20; **ActionRowBuilder,**

&#x20; **StringSelectMenuBuilder,**

&#x20; **RoleSelectMenuBuilder,**

&#x20; **ButtonBuilder,**

&#x20; **ButtonStyle,**

&#x20; **ModalBuilder,**

&#x20; **TextInputBuilder,**

&#x20; **TextInputStyle,**

&#x20; **ChannelType,**

&#x20; **MessageFlags,**

&#x20; **PermissionFlagsBits**

**} = require('discord.js');**

**const config = require('./config.json');**

**// CONFIGURACIÓN**

**const TOKEN = process.env.DISCORD\_TOKEN;**

**const CHANNEL\_ID = process.env.PREDICTION\_CHANNEL\_ID;**

**const SENZ\_CHANNEL\_ID = '1546326086575726662';**

**const NEXT\_EVENT\_CHANNEL\_ID = process.env.NEXT\_EVENT\_CHANNEL\_ID;**

**const SENZ\_PING\_CHANNEL\_ID = '1546328271686471770';**

**const SENZ\_PING\_ROLE\_IDS = new Set(\[**

&#x20; **'1546660494331482195',**

&#x20; **'1546660615203065867',**

&#x20; **'1546660684090052659'**

**]);**

**const RADAR\_PETS = \[**

&#x20; **'Pegasus',**

&#x20; **'Skeleton Horse',**

&#x20; **'Oni Tiger',**

&#x20; **'Gorilla King',**

&#x20; **'Celestial Sunlion',**

&#x20; **'Unicorn',**

&#x20; **'Kitsune',**

&#x20; **'Nightflame',**

&#x20; **'World Burner',**

&#x20; **'ArchAngel',**

&#x20; **'Royal Skywhale'**

**];**



**function detectRadarPets(text) {**

&#x20; **const normalized = normalizeName(text);**

&#x20; **return RADAR\_PETS.filter(name =>**

&#x20;   **normalized.includes(normalizeName(name))**

&#x20; **);**

**}**

**const PREDICTION\_ROLE\_ID = '1561471483748819117';**

**const TIMEZONE = process.env.TIMEZONE || 'America/New\_York';**

**const PREDICTION\_HOUR = Number(process.env.PREDICTION\_HOUR || 13);**

**const PREDICTION\_MINUTE = Number(process.env.PREDICTION\_MINUTE || 30);**

**const OWNER\_ROLE\_IDS = new Set(\[**

&#x20; **'1546327781808537600',**

&#x20; **'1556820095156887562'**

**]);**

**const EVERYONE\_EXEMPT\_ROLE\_IDS = new Set(\[**

&#x20; **'1546327781808537600', // Madaf4kin Owner**

&#x20; **'1556820095156887562', // Madaf4kin Ownaa**

&#x20; **'1561794747901681774'  // Secondary Own**

**]);**

**// BOT GUARDIAN: permisos y documentación**

**const GUARDIAN\_ADMIN\_ROLE\_IDS = new Set(\[**

&#x20; **'1546327781808537600',**

&#x20; **'1556820095156887562',**

&#x20; **'1561794747901681774'**

**]);**

**const GUARDIAN\_WARN\_EXTRA\_ROLE\_IDS = new Set(\[**

&#x20; **'1550293700637233262',**

&#x20; **'1548903507502047312'**

**]);**

**const GUARDIAN\_HERE\_EXEMPT\_ROLE\_IDS = GUARDIAN\_ADMIN\_ROLE\_IDS;**

**const GUARDIAN\_DOCUMENTATION\_CHANNEL\_ID = '1549588388011835473';**

**const GUARDIAN\_GUILD\_ID = process.env.GUARDIAN\_GUILD\_ID || '';**

**const GUARDIAN\_DATA\_FILE = path.join(\_\_dirname, 'data', 'guardian-warnings.json');**

**const DIVINE\_PAGE\_SIZE = 25;**

**const SENZ\_DIVINE\_NAMES = \[**

&#x20; **'Kitsune',**

&#x20; **'World Burner',**

&#x20; **'Nightflame',**

&#x20; **'Unicorn',**

&#x20; **'Royal Skywhale',**

&#x20; **'ArchAngel'**

**];**

**const DIVINE\_REACTION\_EMOJIS = \[**

&#x20; **'<:Unicornio:1546316714432794774>',**

&#x20; **'<:Kitsune:1546316654634471484>',**

&#x20; **'<:NightFlame:1546316561101361242>',**

&#x20; **'<:ArchAngel:1549585015816323092>',**

&#x20; **'<:WorldBurner:1549545829977821264>',**

&#x20; **'<:SkyWhale:1557192169809510400>'**

**];**

**if (!TOKEN) {**

&#x20; **throw new Error('Falta DISCORD\_TOKEN en el archivo .env');**

**}**

**if (!CHANNEL\_ID) {**

&#x20; **throw new Error('Falta PREDICTION\_CHANNEL\_ID en el archivo .env');**

**}**

**if (!Array.isArray(config.divines) || config.divines.length < 5) {**

&#x20; **throw new Error('config.json debe tener al menos 5 elementos en "divines".');**

**}**

**if (!config.prediction) {**

&#x20; **throw new Error('Falta la configuración "prediction" en config.json.');**

**}**

**// ALMACENAMIENTO**

**const DATA\_DIR = path.join(\_\_dirname, 'data');**

**const DATA\_FILE = path.join(DATA\_DIR, 'state.json');**

**fs.mkdirSync(DATA\_DIR, { recursive: true });**

**const defaultState = {**

&#x20; **lastPublishedLocalDate: null,**

&#x20; **predictionMessageId: null,**

&#x20; **predictionChannelId: CHANNEL\_ID,**

&#x20; **currentPrediction: \[],**

&#x20; **chanceState: {},**

&#x20; **antiEveryone: {}**

**};**

**function loadState() {**

&#x20; **try {**

&#x20;   **if (!fs.existsSync(DATA\_FILE)) {**

&#x20;     **return structuredClone(defaultState);**

&#x20;   **}**

&#x20;   **const parsed = JSON.parse(fs.readFileSync(DATA\_FILE, 'utf8'));**

&#x20;   **return {**

&#x20;     **...structuredClone(defaultState),**

&#x20;     **...parsed,**

&#x20;     **chanceState: {**

&#x20;       **...(parsed.chanceState || {})**

&#x20;     **},**

&#x20;     **antiEveryone: {**

&#x20;       **...(parsed.antiEveryone || {})**

&#x20;     **}**

&#x20;   **};**

&#x20; **} catch (error) {**

&#x20;   **console.error('No se pudo leer data/state.json:', error);**

&#x20;   **return structuredClone(defaultState);**

&#x20; **}**

**}**

**let state = loadState();**

**function saveState() {**

&#x20; **const temp = DATA\_FILE + '.tmp';**

&#x20; **fs.writeFileSync(temp, JSON.stringify(state, null, 2));**

&#x20; **fs.renameSync(temp, DATA\_FILE);**

**}**

**// UTILIDADES**

**function randInt(min, max) {**

&#x20; **return Math.floor(Math.random() \* (max - min + 1)) + min;**

**}**

**function normalizeName(value) {**

&#x20; **return String(value || '')**

&#x20;   **.toLowerCase()**

&#x20;   **.normalize('NFD')**

&#x20;   **.replace(/\[\\u0300-\\u036f]/g, '')**

&#x20;   **.replace(/\[^a-z0-9]+/g, '');**

**}**

**function findDivine(input) {**

&#x20; **const normalized = normalizeName(input);**

&#x20; **if (!normalized) return null;**

&#x20; **return config.divines.find(divine => {**

&#x20;   **const names = \[**

&#x20;     **divine.key,**

&#x20;     **divine.name,**

&#x20;     **divine.display,**

&#x20;     **...(divine.aliases || \[])**

&#x20;   **];**

&#x20;   **return names.some(name => {**

&#x20;     **const candidate = normalizeName(name);**

&#x20;     **return candidate \&\& (**

&#x20;       **candidate === normalized ||**

&#x20;       **candidate.includes(normalized) ||**

&#x20;       **normalized.includes(candidate)**

&#x20;     **);**

&#x20;   **});**

&#x20; **}) || null;**

**}**

**function getDivineDisplay(divine) {**

&#x20; **return divine.display || divine.name || divine.key;**

**}**

**function buildUtcTimestamp(dateTime) {**

&#x20; **return Math.floor(dateTime.toUTC().toSeconds());**

**}**

**async function addDivineReactions(message) {**

&#x20; **for (const emoji of DIVINE\_REACTION\_EMOJIS) {**

&#x20;   **try {**

&#x20;     **await message.react(emoji);**

&#x20;   **} catch (error) {**

&#x20;     **console.error(**

&#x20;       **`No pude añadir la reacción ${emoji} a la predicción:`,**

&#x20;       **error.message**

&#x20;     **);**

&#x20;   **}**

&#x20; **}**

**}**

**// PERMISOS DE OWNER**

**function hasOwnerRole(member) {**

&#x20; **return Boolean(**

&#x20;   **member?.roles?.cache?.some(role =>**

&#x20;     **OWNER\_ROLE\_IDS.has(role.id)**

&#x20;   **)**

&#x20; **);**

**}**

**async function ensureOwner(interaction) {**

&#x20; **if (!interaction.guild) {**

&#x20;   **await interaction.reply({**

&#x20;     **content: '❌ Este comando solo se puede usar en un servidor.',**

&#x20;     **ephemeral: true**

&#x20;   **});**

&#x20;   **return false;**

&#x20; **}**

&#x20; **let member = interaction.guild.members.cache.get(**

&#x20;   **interaction.user.id**

&#x20; **);**

&#x20; **if (!member) {**

&#x20;   **member = await interaction.guild.members**

&#x20;     **.fetch(interaction.user.id)**

&#x20;     **.catch(() => null);**

&#x20; **}**

&#x20; **if (!hasOwnerRole(member)) {**

&#x20;   **const payload = {**

&#x20;     **content:**

&#x20;       **'⛔ No tenés permiso. Solo los roles Madaf4kin Owner y Madaf4kin Ownaa pueden utilizar esta función.',**

&#x20;     **ephemeral: true**

&#x20;   **};**

&#x20;   **if (interaction.replied || interaction.deferred) {**

&#x20;     **await interaction.followUp(payload).catch(() => {});**

&#x20;   **} else {**

&#x20;     **await interaction.reply(payload).catch(() => {});**

&#x20;   **}**

&#x20;   **return false;**

&#x20; **}**

&#x20; **return true;**

**}**

**// LECTURA DE SENZ V2**

**async function getSenzLastSeen(client) {**

&#x20; **const channel = await client.channels.fetch(SENZ\_CHANNEL\_ID);**

&#x20; **if (!channel || !channel.isTextBased() || !channel.messages) {**

&#x20;   **throw new Error('No puedo acceder al canal de SenZ V2.');**

&#x20; **}**

&#x20; **const messages = await channel.messages.fetch({ limit: 100 });**

&#x20; **function extractText(components) {**

&#x20;   **const parts = \[];**

&#x20;   **for (const component of components || \[]) {**

&#x20;     **if (typeof component.content === 'string') {**

&#x20;       **parts.push(component.content);**

&#x20;     **}**

&#x20;     **if (Array.isArray(component.components)) {**

&#x20;       **parts.push(extractText(component.components));**

&#x20;     **}**

&#x20;   **}**

&#x20;   **return parts.join('\\n');**

&#x20; **}**

&#x20; **const candidates = \[...messages.values()]**

&#x20;   **.map(message => {**

&#x20;     **const content = \[**

&#x20;       **message.content || '',**

&#x20;       **...message.embeds.map(embed => \[**

&#x20;         **embed.title || '',**

&#x20;         **embed.description || '',**

&#x20;         **...(embed.fields || \[]).flatMap(field => \[**

&#x20;           **field.name || '',**

&#x20;           **field.value || ''**

&#x20;         **])**

&#x20;       **].join('\\n')),**

&#x20;       **extractText(message.components)**

&#x20;     **].join('\\n');**

&#x20;     **return { message, content };**

&#x20;   **})**

&#x20;   **.filter(item =>**

&#x20;     **/Divine\\s\*\[-—–]\\s\*Last\\s\*Seen/i.test(item.content)**

&#x20;   **)**

&#x20;   **.sort(**

&#x20;     **(a, b) =>**

&#x20;       **b.message.createdTimestamp - a.message.createdTimestamp**

&#x20;   **);**

&#x20; **if (candidates.length === 0) {**

&#x20;   **throw new Error(**

&#x20;     **'No encontré Divine — Last Seen en los últimos 100 mensajes accesibles de SenZ.'**

&#x20;   **);**

&#x20; **}**

&#x20; **for (const candidate of candidates) {**

&#x20;   **const content = candidate.content;**

&#x20;   **const headerRegex = /###\\s\*.\*?Divine\\s\*\[-—–]\\s\*Last\\s\*Seen/i;**

&#x20;   **const headerMatch = headerRegex.exec(content);**

&#x20;   **if (!headerMatch) continue;**

&#x20;   **const afterHeader = content.slice(**

&#x20;     **headerMatch.index + headerMatch\[0].length**

&#x20;   **);**

&#x20;   **const nextSection = /\\n\\s\*#{1,6}\\s+/g.exec(afterHeader);**

&#x20;   **const divineSection = nextSection**

&#x20;     **? afterHeader.slice(0, nextSection.index)**

&#x20;     **: afterHeader;**

&#x20;   **const result = new Map();**

&#x20;   **const lineRegex =**

&#x20;     **/^\\s\*.\*?(\[A-Za-z]\[A-Za-z ]\*?)\\s\*\[—–-]\\s\*<t:(\\d+):\[tTdDfFR]>\\s\*$/gm;**

&#x20;   **for (const match of divineSection.matchAll(lineRegex)) {**

&#x20;     **const name = match\[1].trim();**

&#x20;     **const timestamp = Number(match\[2]);**

&#x20;     **const normalized = normalizeName(name);**

&#x20;     **const canonical = SENZ\_DIVINE\_NAMES.find(**

&#x20;       **item => normalizeName(item) === normalized**

&#x20;     **);**

&#x20;     **if (**

&#x20;       **canonical \&\&**

&#x20;       **Number.isSafeInteger(timestamp) \&\&**

&#x20;       **timestamp > 0**

&#x20;     **) {**

&#x20;       **result.set(canonical, timestamp);**

&#x20;     **}**

&#x20;   **}**

&#x20;   **const missing = SENZ\_DIVINE\_NAMES.filter(**

&#x20;     **name => !result.has(name)**

&#x20;   **);**

&#x20;   **if (missing.length === 0) {**

&#x20;     **return result;**

&#x20;   **}**

&#x20; **}**

&#x20; **throw new Error(**

&#x20;   **'No se encontraron todos los Divines en los componentes de SenZ. ' +**

&#x20;   **'Faltan: ' + SENZ\_DIVINE\_NAMES.filter(name => {**

&#x20;     **return !candidates.some(candidate => {**

&#x20;       **const text = candidate.content;**

&#x20;       **return text.includes(name);**

&#x20;     **});**

&#x20;   **}).join(', ') +**

&#x20;   **'. No se publicó la predicción.'**

&#x20; **);**

**}**

**// PROBABILIDADES SEGÚN EL TIEMPO DESDE LA ÚLTIMA APARICIÓN**

**function calculateSenzChance(divineName, lastSeenTimestamp) {**

&#x20; **const elapsedSeconds = Math.max(**

&#x20;   **0,**

&#x20;   **Math.floor(Date.now() / 1000) - lastSeenTimestamp**

&#x20; **);**

&#x20; **const elapsedDays = elapsedSeconds / 86400;**

&#x20; **const name = normalizeName(divineName);**

&#x20; **const specialDivines = \[**

&#x20;   **'nightflame',**

&#x20;   **'kitsune',**

&#x20;   **'unicorn'**

&#x20; **];**

&#x20; **const isSpecial = specialDivines.includes(name);**

&#x20; **if (elapsedDays < 1) return 11;**

&#x20; **if (elapsedDays < 2) return 20;**

&#x20; **if (elapsedDays < 3) return 25;**

&#x20; **if (elapsedDays < 4) {**

&#x20;   **return name === 'kitsune' || name === 'unicorn'**

&#x20;     **? 40**

&#x20;     **: 35;**

&#x20; **}**

&#x20; **if (elapsedDays < 5) {**

&#x20;   **return isSpecial ? 50 : 48;**

&#x20; **}**

&#x20; **if (!isSpecial) {**

&#x20;   **return 48;**

&#x20; **}**

&#x20; **const extraDays = Math.floor(elapsedDays) - 5;**

&#x20; **return Math.min(89, 60 + extraDays \* 5);**

**}**

**function getSenzDivineObjects() {**

&#x20; **return SENZ\_DIVINE\_NAMES.map(senzName => {**

&#x20;   **const divine = config.divines.find(item => {**

&#x20;     **const names = \[**

&#x20;       **item.key,**

&#x20;       **item.name,**

&#x20;       **item.display,**

&#x20;       **...(item.aliases || \[])**

&#x20;     **].filter(Boolean);**

&#x20;     **return names.some(name =>**

&#x20;       **normalizeName(name) === normalizeName(senzName)**

&#x20;     **);**

&#x20;   **});**

&#x20;   **if (!divine) {**

&#x20;     **throw new Error(**

&#x20;       **`No encontré "${senzName}" en config.json. Revisá su nombre o aliases.`**

&#x20;     **);**

&#x20;   **}**

&#x20;   **return divine;**

&#x20; **});**

**}**

**function getSenzDivineChance(divine, lastSeenData) {**

&#x20; **const possibleNames = \[**

&#x20;   **divine.key,**

&#x20;   **divine.name,**

&#x20;   **divine.display,**

&#x20;   **...(divine.aliases || \[])**

&#x20; **].filter(Boolean);**

&#x20; **const matchingName = SENZ\_DIVINE\_NAMES.find(senzName =>**

&#x20;   **possibleNames.some(name =>**

&#x20;     **normalizeName(name) === normalizeName(senzName)**

&#x20;   **)**

&#x20; **);**

&#x20; **if (!matchingName || !lastSeenData.has(matchingName)) {**

&#x20;   **throw new Error(**

&#x20;     **`No hay datos válidos de SenZ para ${getDivineDisplay(divine)}.`**

&#x20;   **);**

&#x20; **}**

&#x20; **return calculateSenzChance(**

&#x20;   **matchingName,**

&#x20;   **lastSeenData.get(matchingName)**

&#x20; **);**

**}**

**// HORARIOS DE LAS PREDICCIONES AUTOMÁTICAS**

**function randomPredictionTimes() {**

&#x20; **const now = DateTime.now().setZone(TIMEZONE);**

&#x20; **let lower = now.plus({**

&#x20;   **hours: config.prediction.scheduleMinHoursAhead || 0**

&#x20; **});**

&#x20; **if (lower <= now) {**

&#x20;   **lower = now.plus({ minutes: 1 });**

&#x20; **}**

&#x20; **lower = lower**

&#x20;   **.set({ second: 0, millisecond: 0 })**

&#x20;   **.plus({ minutes: (5 - (lower.minute % 5)) % 5 });**

&#x20; **if (lower <= now) {**

&#x20;   **lower = lower.plus({ minutes: 5 });**

&#x20; **}**

&#x20; **const endOfDay = now.endOf('day');**

&#x20; **const available = \[];**

&#x20; **for (**

&#x20;   **let candidate = lower;**

&#x20;   **candidate <= endOfDay;**

&#x20;   **candidate = candidate.plus({ minutes: 5 })**

&#x20; **) {**

&#x20;   **if (candidate > now) {**

&#x20;     **available.push(candidate);**

&#x20;   **}**

&#x20; **}**

&#x20; **if (available.length < 5) {**

&#x20;   **throw new Error(**

&#x20;     **'No hay suficientes horarios de 5 minutos disponibles para hoy.'**

&#x20;   **);**

&#x20; **}**

&#x20; **const chosen = \[];**

&#x20; **while (chosen.length < 5) {**

&#x20;   **const index = randInt(0, available.length - 1);**

&#x20;   **chosen.push(available.splice(index, 1)\[0]);**

&#x20; **}**

&#x20; **return chosen.sort((a, b) => a.toMillis() - b.toMillis());**

**}**

**function randomFiveDivines() {**

&#x20; **const available = getSenzDivineObjects();**

&#x20; **const selected = \[];**

&#x20; **while (selected.length < 5) {**

&#x20;   **const index = randInt(0, available.length - 1);**

&#x20;   **selected.push(available.splice(index, 1)\[0]);**

&#x20; **}**

&#x20; **return selected;**

**}**

**// EMBED DE LA PREDICCIÓN AUTOMÁTICA**

**function getPredictionLines(prediction) {**

&#x20; **return prediction**

&#x20;   **.slice()**

&#x20;   **.sort((a, b) => a.timestamp - b.timestamp)**

&#x20;   **.map(item => {**

&#x20;     **const divine = findDivine(item.key);**

&#x20;     **if (!divine) {**

&#x20;       **return `\*\*${item.key}\*\* · ${item.chance}% · <t:${item.timestamp}:R>`;**

&#x20;     **}**

&#x20;     **const display = getDivineDisplay(divine);**

&#x20;     **const zone = divine.zone**

&#x20;       **? ` · ${divine.zoneEmoji ? divine.zoneEmoji + ' ' : ''}${divine.zone}`**

&#x20;       **: '';**

&#x20;     **return `${display}${zone} · \*\*${item.chance}%\*\* · <t:${item.timestamp}:R>`;**

&#x20;   **});**

**}**

**function buildEmbed(prediction) {**

&#x20; **return new EmbedBuilder()**

&#x20;   **.setColor(0x7C3AED)**

&#x20;   **.setTitle(config.prediction.title || '🥚 SAE PREDICTION')**

&#x20;   **.setDescription(\[**

&#x20;     **config.prediction.header || '\*\*Predicciones de hoy:\*\*',**

&#x20;     **'',**

&#x20;     **...getPredictionLines(prediction)**

&#x20;   **].join('\\n'))**

&#x20;   **.setFooter({**

&#x20;     **text: 'SAE PREDICTION · Las predicciones pueden fallar.'**

&#x20;   **})**

&#x20;   **.setTimestamp(new Date());**

**}**

**// ==========================================================// PUMPKIN KING EVENT// ==========================================================**

**// UFO EVENT**

**async function publishUFOEvent(client) {**

&#x20; **try {**

&#x20;   **console.log('Intentando enviar UFO EVENT...');**



&#x20;   **const channel = await client.channels.fetch(NEXT\_EVENT\_CHANNEL\_ID);**



&#x20;   **if (!channel || !channel.isTextBased()) {**

&#x20;     **throw new Error('NEXT\_EVENT\_CHANNEL\_ID no apunta a un canal de texto válido.');**

&#x20;   **}**



&#x20;   **const embed = new EmbedBuilder()**

&#x20;     **.setColor(0x5865F2)**

&#x20;     **.setTitle('🛸 OVNI EVENT IS NOW ACTIVE!')**

&#x20;     **.setDescription(**

&#x20;       **'<:Roblox:1564309702085443744> \*\*Únete al juego:\*\* \[Click Here](https://www.roblox.com/games/107778070777162/Steal-An-Egg)'**

&#x20;     **)**

&#x20;     **.setTimestamp();**



&#x20;   **await channel.send({**

&#x20;     **content: '<@\&1556402418911289415>',**

&#x20;     **embeds: \[embed],**

&#x20;     **allowedMentions: {**

&#x20;       **roles: \['1556402418911289415']**

&#x20;     **}**

&#x20;   **});**



&#x20;   **console.log('UFO EVENT enviado correctamente.');**

&#x20;   **return true;**



&#x20; **} catch (error) {**

&#x20;   **console.error('Error enviando UFO EVENT:', error);**

&#x20;   **return false;**

&#x20; **}**

**}**

**// PUBLICAR PREDICCIÓN AUTOMÁTICA**

**async function publishDailyPrediction(client, options = {}) {**

&#x20; **const now = DateTime.now().setZone(TIMEZONE);**

&#x20; **const localDate = now.toISODate();**

&#x20; **if (**

&#x20;   **!options.force \&\&**

&#x20;   **state.lastPublishedLocalDate === localDate**

&#x20; **) {**

&#x20;   **return;**

&#x20; **}**

&#x20; **const lastSeenData = await getSenzLastSeen(client);**

&#x20; **const times = randomPredictionTimes();**

&#x20; **const selectedDivines = randomFiveDivines();**

&#x20; **const prediction = selectedDivines**

&#x20;   **.map((divine, index) => ({**

&#x20;     **key: divine.key,**

&#x20;     **timestamp: buildUtcTimestamp(times\[index]),**

&#x20;     **chance: getSenzDivineChance(divine, lastSeenData)**

&#x20;   **}))**

&#x20;   **.sort((a, b) => a.timestamp - b.timestamp);**

&#x20; **const channel = await client.channels.fetch(CHANNEL\_ID);**

&#x20; **if (!channel || !channel.isTextBased()) {**

&#x20;   **throw new Error(**

&#x20;     **'PREDICTION\_CHANNEL\_ID no apunta a un canal de texto.'**

&#x20;   **);**

&#x20; **}**

&#x20; **const message = await channel.send({**

&#x20;   **content: `<@\&${PREDICTION\_ROLE\_ID}>`,**

&#x20;   **embeds: \[buildEmbed(prediction)],**

&#x20;   **allowedMentions: {**

&#x20;     **parse: \[],**

&#x20;     **roles: \[PREDICTION\_ROLE\_ID]**

&#x20;   **}**

&#x20; **});**

&#x20; **await addDivineReactions(message);**

&#x20; **state.lastPublishedLocalDate = localDate;**

&#x20; **state.predictionMessageId = message.id;**

&#x20; **state.predictionChannelId = CHANNEL\_ID;**

&#x20; **state.currentPrediction = prediction;**

&#x20; **saveState();**

&#x20; **console.log('Predicción diaria publicada:', message.url);**

**}**

**// PARSEO PARA EDITAR PREDICCIONES EXISTENTES**

**function parseTime(content) {**

&#x20; **const cleaned = content.toLowerCase();**

&#x20; **const match = cleaned.match(/\\b(\\d{1,2}):(\\d{2})\\b/);**

&#x20; **if (!match) return null;**

&#x20; **const hour = Number(match\[1]);**

&#x20; **const minute = Number(match\[2]);**

&#x20; **if (hour > 23 || minute > 59) return null;**

&#x20; **const now = DateTime.now().setZone(TIMEZONE);**

&#x20; **let date = now.startOf('day');**

&#x20; **if (/\\bpasado\\s+manana\\b|\\bpasado\\s+mañana\\b/.test(cleaned)) {**

&#x20;   **date = date.plus({ days: 2 });**

&#x20; **} else if (/\\bmanana\\b|\\bmañana\\b/.test(cleaned)) {**

&#x20;   **date = date.plus({ days: 1 });**

&#x20; **} else {**

&#x20;   **const dateMatch = cleaned.match(**

&#x20;     **/\\b(\\d{1,2})\[/-](\\d{1,2})(?:\[/-](\\d{2,4}))?\\b/**

&#x20;   **);**

&#x20;   **if (dateMatch) {**

&#x20;     **let year = dateMatch\[3]**

&#x20;       **? Number(dateMatch\[3])**

&#x20;       **: now.year;**

&#x20;     **if (year < 100) year += 2000;**

&#x20;     **date = DateTime.fromObject({**

&#x20;       **year,**

&#x20;       **month: Number(dateMatch\[2]),**

&#x20;       **day: Number(dateMatch\[1])**

&#x20;     **}, {**

&#x20;       **zone: TIMEZONE**

&#x20;     **}).startOf('day');**

&#x20;     **if (!date.isValid) return null;**

&#x20;   **} else {**

&#x20;     **const candidate = date.set({**

&#x20;       **hour,**

&#x20;       **minute,**

&#x20;       **second: 0,**

&#x20;       **millisecond: 0**

&#x20;     **});**

&#x20;     **return candidate > now**

&#x20;       **? candidate**

&#x20;       **: candidate.plus({ days: 1 });**

&#x20;   **}**

&#x20; **}**

&#x20; **return date.set({**

&#x20;   **hour,**

&#x20;   **minute,**

&#x20;   **second: 0,**

&#x20;   **millisecond: 0**

&#x20; **});**

**}**

**function parseChance(content) {**

&#x20; **const match = content.match(/(?:^|\\s)(\\d{1,3})\\s\*%/i);**

&#x20; **if (!match) return null;**

&#x20; **const chance = Number(match\[1]);**

&#x20; **return chance >= 0 \&\& chance <= 89**

&#x20;   **? chance**

&#x20;   **: null;**

**}**

**// EDITAR LA PREDICCIÓN AUTOMÁTICA ACTUAL**

**async function editCurrentPrediction(**

&#x20; **client,**

&#x20; **divine,**

&#x20; **newTime,**

&#x20; **newChance**

**) {**

&#x20; **const now = DateTime.now().setZone(TIMEZONE);**

&#x20; **const diffHours = newTime.diff(now, 'hours').hours;**

&#x20; **if (**

&#x20;   **!state.predictionMessageId ||**

&#x20;   **diffHours < 0 ||**

&#x20;   **diffHours > 72**

&#x20; **) {**

&#x20;   **return false;**

&#x20; **}**

&#x20; **const channel = await client.channels.fetch(**

&#x20;   **state.predictionChannelId || CHANNEL\_ID**

&#x20; **);**

&#x20; **if (!channel || !channel.isTextBased()) return false;**

&#x20; **const message = await channel.messages.fetch(**

&#x20;   **state.predictionMessageId**

&#x20; **);**

&#x20; **const current = (state.currentPrediction || \[])**

&#x20;   **.map(item => ({ ...item }));**

&#x20; **const target = current.find(**

&#x20;   **item => normalizeName(item.key) === normalizeName(divine.key)**

&#x20; **);**

&#x20; **if (!target) return false;**

&#x20; **target.timestamp = buildUtcTimestamp(newTime);**

&#x20; **if (newChance !== null) {**

&#x20;   **target.chance = newChance;**

&#x20; **}**

&#x20; **current.sort((a, b) => a.timestamp - b.timestamp);**

&#x20; **state.currentPrediction = current;**

&#x20; **saveState();**

&#x20; **await message.edit({**

&#x20;   **embeds: \[buildEmbed(current)]**

&#x20; **});**

&#x20; **return true;**

**}**

**// COMANDO /ADDPREDICTION**

**function buildDivineSelectRows(userId, page = 0) {**

&#x20; **const totalPages = Math.ceil(**

&#x20;   **config.divines.length / DIVINE\_PAGE\_SIZE**

&#x20; **);**

&#x20; **const start = page \* DIVINE\_PAGE\_SIZE;**

&#x20; **const divines = config.divines.slice(**

&#x20;   **start,**

&#x20;   **start + DIVINE\_PAGE\_SIZE**

&#x20; **);**

&#x20; **const select = new StringSelectMenuBuilder()**

&#x20;   **.setCustomId(`addprediction\_divine:${userId}:${page}`)**

&#x20;   **.setPlaceholder('¿Qué personaje querés predecir?')**

&#x20;   **.setMinValues(1)**

&#x20;   **.setMaxValues(1)**

&#x20;   **.addOptions(**

&#x20;     **divines.map(divine => ({**

&#x20;       **label: String(**

&#x20;         **divine.name || divine.display || divine.key**

&#x20;       **).slice(0, 100),**

&#x20;       **value: String(divine.key).slice(0, 100),**

&#x20;       **description: String(divine.zone || 'Divine').slice(0, 100)**

&#x20;     **}))**

&#x20;   **);**

&#x20; **const rows = \[**

&#x20;   **new ActionRowBuilder().addComponents(select)**

&#x20; **];**

&#x20; **if (totalPages > 1) {**

&#x20;   **const buttons = \[];**

&#x20;   **if (page > 0) {**

&#x20;     **buttons.push(**

&#x20;       **new ButtonBuilder()**

&#x20;         **.setCustomId(`addprediction\_page:${userId}:${page - 1}`)**

&#x20;         **.setLabel('Anterior')**

&#x20;         **.setStyle(ButtonStyle.Secondary)**

&#x20;     **);**

&#x20;   **}**

&#x20;   **if (page < totalPages - 1) {**

&#x20;     **buttons.push(**

&#x20;       **new ButtonBuilder()**

&#x20;         **.setCustomId(`addprediction\_page:${userId}:${page + 1}`)**

&#x20;         **.setLabel('Siguiente')**

&#x20;         **.setStyle(ButtonStyle.Secondary)**

&#x20;     **);**

&#x20;   **}**

&#x20;   **rows.push(new ActionRowBuilder().addComponents(buttons));**

&#x20; **}**

&#x20; **return rows;**

**}**

**function parseUpcomingClockTime(value) {**

&#x20; **const match = String(value || '')**

&#x20;   **.trim()**

&#x20;   **.match(/^(\[01]\\d|2\[0-3]):(\[0-5]\\d)$/);**

&#x20; **if (!match) return null;**

&#x20; **const hour = Number(match\[1]);**

&#x20; **const minute = Number(match\[2]);**

&#x20; **const now = DateTime.now().setZone(TIMEZONE);**

&#x20; **let candidate = now.set({**

&#x20;   **hour,**

&#x20;   **minute,**

&#x20;   **second: 0,**

&#x20;   **millisecond: 0**

&#x20; **});**

&#x20; **if (candidate <= now) {**

&#x20;   **candidate = candidate.plus({ days: 1 });**

&#x20; **}**

&#x20; **return candidate;**

**}**

**function buildManualPredictionEmbed(**

&#x20; **divine,**

&#x20; **firstTime,**

&#x20; **secondTime,**

&#x20; **chance**

**) {**

&#x20; **const firstTimestamp = buildUtcTimestamp(firstTime);**

&#x20; **const secondTimestamp = buildUtcTimestamp(secondTime);**

&#x20; **const display = getDivineDisplay(divine);**

&#x20; **return new EmbedBuilder()**

&#x20;   **.setColor(0x7C3AED)**

&#x20;   **.setTitle(`DIVINE PREDICTION: ${chance}%`)**

&#x20;   **.setDescription(**

&#x20;     **`# ${display}\\n` +**

&#x20;     **`<t:${firstTimestamp}:R> \~ <t:${secondTimestamp}:R>`**

&#x20;   **)**

&#x20;   **.setFooter({**

&#x20;     **text: 'SAE PREDICTION · Las predicciones pueden fallar.'**

&#x20;   **})**

&#x20;   **.setTimestamp(new Date());**

**}**

**// BOT GUARDIAN: persistencia de advertencias**

**if (!fs.existsSync(path.dirname(GUARDIAN\_DATA\_FILE))) {**

&#x20; **fs.mkdirSync(path.dirname(GUARDIAN\_DATA\_FILE), { recursive: true });**

**}**

**if (!fs.existsSync(GUARDIAN\_DATA\_FILE)) {**

&#x20; **fs.writeFileSync(GUARDIAN\_DATA\_FILE, JSON.stringify({ guilds: {} }, null, 2));**

**}**

**function loadGuardianWarnings() {**

&#x20; **try {**

&#x20;   **const parsed = JSON.parse(fs.readFileSync(GUARDIAN\_DATA\_FILE, 'utf8'));**

&#x20;   **return parsed \&\& parsed.guilds ? parsed : { guilds: {} };**

&#x20; **} catch (error) {**

&#x20;   **console.error('BOT GUARDIAN: no se pudo leer el historial de warns:', error);**

&#x20;   **return { guilds: {} };**

&#x20; **}**

**}**

**let guardianWarnings = loadGuardianWarnings();**

**function saveGuardianWarnings() {**

&#x20; **const temporary = `${GUARDIAN\_DATA\_FILE}.tmp`;**

&#x20; **fs.writeFileSync(temporary, JSON.stringify(guardianWarnings, null, 2));**

&#x20; **fs.renameSync(temporary, GUARDIAN\_DATA\_FILE);**

**}**

**function getGuardianUserRecord(guildId, userId) {**

&#x20; **if (!guardianWarnings.guilds\[guildId]) guardianWarnings.guilds\[guildId] = {};**

&#x20; **if (!guardianWarnings.guilds\[guildId]\[userId]) guardianWarnings.guilds\[guildId]\[userId] = \[];**

&#x20; **return guardianWarnings.guilds\[guildId]\[userId];**

**}**

**function memberHasOneOf(member, roleIds) {**

&#x20; **return Boolean(member?.roles?.cache \&\& \[...roleIds].some(id => member.roles.cache.has(id)));**

**}**

**function guardianCanAdmin(member) {**

&#x20; **return memberHasOneOf(member, GUARDIAN\_ADMIN\_ROLE\_IDS);**

**}**

**function guardianCanWarn(member) {**

&#x20; **return guardianCanAdmin(member) || memberHasOneOf(member, GUARDIAN\_WARN\_EXTRA\_ROLE\_IDS);**

**}**

**async function guardianLog(guild, user, reason, total, sanction) {**

&#x20; **try {**

&#x20;   **const channel = await guild.channels.fetch(GUARDIAN\_DOCUMENTATION\_CHANNEL\_ID);**

&#x20;   **if (!channel?.isTextBased() || !channel.isSendable()) {**

&#x20;     **console.error('BOT GUARDIAN: el canal de documentación no está disponible.');**

&#x20;     **return;**

&#x20;   **}**

&#x20;   **const embed = new EmbedBuilder()**

&#x20;     **.setColor(0x475569)**

&#x20;     **.setTitle('Registro de moderación')**

&#x20;     **.setDescription(**

&#x20;       **`Usuario: ${user.tag} (${user.id})\\n` +**

&#x20;       **`Infracción: ${reason}\\n` +**

&#x20;       **`Total de advertencias: ${total}\\n` +**

&#x20;       **`Sanción: ${sanction}`**

&#x20;     **)**

&#x20;     **.setTimestamp(new Date());**

&#x20;   **await channel.send({ embeds: \[embed], allowedMentions: { parse: \[] } });**

&#x20; **} catch (error) {**

&#x20;   **console.error('BOT GUARDIAN: no se pudo registrar el suceso:', error.message);**

&#x20; **}**

**}**

**async function guardianAddWarning(guild, user, reason, source = 'manual') {**

&#x20; **const warnings = getGuardianUserRecord(guild.id, user.id);**

&#x20; **warnings.push({ reason, source, createdAt: new Date().toISOString() });**

&#x20; **const total = warnings.length;**

&#x20; **let duration = 0;**

&#x20; **let durationLabel = 'Sin timeout automático';**

&#x20; **if (total >= 30) {**

&#x20;   **duration = 24 \* 60 \* 60 \* 1000;**

&#x20;   **durationLabel = '24 horas';**

&#x20; **} else if (total >= 6) {**

&#x20;   **duration = 60 \* 60 \* 1000;**

&#x20;   **durationLabel = '1 hora';**

&#x20; **} else if (total === 5) {**

&#x20;   **duration = 10 \* 60 \* 1000;**

&#x20;   **durationLabel = '10 minutos';**

&#x20; **} else if (total === 3) {**

&#x20;   **duration = 60 \* 1000;**

&#x20;   **durationLabel = '1 minuto';**

&#x20; **}**

&#x20; **let sanction = 'Advertencia registrada.';**

&#x20; **if (duration > 0) {**

&#x20;   **const member = await guild.members.fetch(user.id).catch(() => null);**

&#x20;   **if (member?.moderatable) {**

&#x20;     **try {**

&#x20;       **await member.timeout(duration, `BOT GUARDIAN: ${reason}`);**

&#x20;       **sanction = `Timeout de ${durationLabel}.`;**

&#x20;     **} catch (error) {**

&#x20;       **sanction = `No se pudo aplicar timeout de ${durationLabel}: ${error.message}`;**

&#x20;     **}**

&#x20;   **} else {**

&#x20;     **sanction = `Advertencia registrada; no se pudo aplicar timeout de ${durationLabel} por permisos o jerarquía de roles.`;**

&#x20;   **}**

&#x20; **}**

&#x20; **saveGuardianWarnings();**

&#x20; **await guardianLog(guild, user, reason, total, sanction);**

&#x20; **return { total, sanction };**

**}**

**async function guardianSendDm(user, text) {**

&#x20; **try {**

&#x20;   **await user.send(text);**

&#x20;   **return true;**

&#x20; **} catch {**

&#x20;   **return false;**

&#x20; **}**

**}**

**function guardianIsAllowedGuild(interaction) {**

&#x20; **return Boolean(GUARDIAN\_GUILD\_ID \&\& interaction.guildId === GUARDIAN\_GUILD\_ID);**

**}**

**// REGISTRAR COMANDOS**

**async function registerSlashCommands(readyClient) {**

&#x20; **try {**

&#x20;   **const commands = \[**

&#x20;     **new SlashCommandBuilder()**

&#x20;       **.setName('addprediction')**

&#x20;       **.setDescription('Crear una predicción manual para un Divine'),**

&#x20;     **new SlashCommandBuilder()**

&#x20;       **.setName('warn')**

&#x20;       **.setDescription('Registrar una advertencia de moderación')**

&#x20;       **.addUserOption(option => option.setName('usuario').setDescription('Usuario que recibirá la advertencia').setRequired(true))**

&#x20;       **.addStringOption(option => option.setName('motivo').setDescription('Motivo de la advertencia').setRequired(true).setMaxLength(500)),**

&#x20;     **new SlashCommandBuilder()**

&#x20;       **.setName('documentacion')**

&#x20;       **.setDescription('Consultar las advertencias de un usuario')**

&#x20;       **.addUserOption(option => option.setName('usuario').setDescription('Usuario que se desea consultar').setRequired(true)),**

&#x20;     **new SlashCommandBuilder()**

&#x20;       **.setName('sendmessage')**

&#x20;       **.setDescription('Enviar un mensaje a un canal')**

&#x20;       **.addStringOption(option => option.setName('contenido').setDescription('Contenido del mensaje').setRequired(true).setMaxLength(2000))**

&#x20;       **.addChannelOption(option => option.setName('canal').setDescription('Canal de destino').addChannelTypes(ChannelType.GuildText).setRequired(false))**

&#x20;       **.addUserOption(option => option.setName('mencionar').setDescription('Usuario a mencionar (opcional)').setRequired(false))**

&#x20;       **.addAttachmentOption(option => option.setName('archivo').setDescription('Archivo adjunto opcional').setRequired(false)),**

&#x20;     **new SlashCommandBuilder()**

&#x20;       **.setName('embed')**

&#x20;       **.setDescription('Crear y publicar un embed personalizado')**

&#x20;       **.addChannelOption(option => option**

&#x20;         **.setName('canal')**

&#x20;         **.setDescription('Canal donde se publicará el embed')**

&#x20;         **.addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)**

&#x20;         **.setRequired(true))**

&#x20;   **].map(command => command.toJSON());**

&#x20;   **const rest = new REST({ version: '10' }).setToken(TOKEN);**

&#x20;   **for (const guild of readyClient.guilds.cache.values()) {**

&#x20;     **await rest.put(**

&#x20;       **Routes.applicationGuildCommands(**

&#x20;         **readyClient.user.id,**

&#x20;         **guild.id**

&#x20;       **),**

&#x20;       **{ body: commands }**

&#x20;     **);**

&#x20;     **console.log(**

&#x20;       **`✅ Comando /addprediction registrado en ${guild.name}`**

&#x20;     **);**

&#x20;   **}**

&#x20; **} catch (error) {**

&#x20;   **console.error('❌ Error registrando comandos slash:', error);**

&#x20; **}**

**}**

**// BORRADORES TEMPORALES DEL CONSTRUCTOR DE EMBEDS**

**// Se guardan entre los dos formularios mientras el proceso del bot siga activo.**

**const embedDrafts = new Map();**

**function isValidHttpUrl(value) {**

&#x20; **if (!value) return true;**

&#x20; **try {**

&#x20;   **const parsed = new URL(value);**

&#x20;   **return parsed.protocol === 'http:' || parsed.protocol === 'https:';**

&#x20; **} catch {**

&#x20;   **return false;**

&#x20; **}**

**}**

**const EMBED\_COLOR\_NAMES = {**

&#x20; **morado: 0x7C3AED,**

&#x20; **violeta: 0x8B5CF6,**

&#x20; **purpura: 0x7C3AED,**

&#x20; **rojo: 0xE53935,**

&#x20; **azul: 0x1E88E5,**

&#x20; **'azul oscuro': 0x0D47A1,**

&#x20; **celeste: 0x29B6F6,**

&#x20; **verde: 0x43A047,**

&#x20; **'verde oscuro': 0x1B5E20,**

&#x20; **amarillo: 0xFDD835,**

&#x20; **naranja: 0xFB8C00,**

&#x20; **rosa: 0xEC407A,**

&#x20; **negro: 0x23272A,**

&#x20; **blanco: 0xFFFFFF,**

&#x20; **gris: 0x95A5A6,**

&#x20; **'gris oscuro': 0x424549,**

&#x20; **turquesa: 0x1ABC9C,**

&#x20; **cian: 0x00BCD4,**

&#x20; **cyan: 0x00BCD4,**

&#x20; **magenta: 0xD81B60,**

&#x20; **dorado: 0xD4AF37,**

&#x20; **oro: 0xD4AF37**

**};**

**function resolveEmbedColor(value) {**

&#x20; **if (!value || !value.trim()) return EMBED\_COLOR\_NAMES.morado;**

&#x20; **const raw = value.trim();**

&#x20; **const hex = raw.startsWith('#') ? raw.slice(1) : raw;**

&#x20; **if (/^\[0-9a-fA-F]{6}$/.test(hex)) return Number.parseInt(hex, 16);**

&#x20; **const normalized = raw.toLowerCase()**

&#x20;   **.normalize('NFD').replace(/\[\\u0300-\\u036f]/g, '');**

&#x20; **return Object.prototype.hasOwnProperty.call(EMBED\_COLOR\_NAMES, normalized)**

&#x20;   **? EMBED\_COLOR\_NAMES\[normalized]**

&#x20;   **: null;**

**}**

**function readEmbedFieldPair(interaction, nameId, valueId, label) {**

&#x20; **const name = interaction.fields.getTextInputValue(nameId).trim();**

&#x20; **const value = interaction.fields.getTextInputValue(valueId).trim();**

&#x20; **if (!name \&\& !value) return { field: null, error: null };**

&#x20; **if (!name || !value) {**

&#x20;   **return { field: null, error: `En el campo ${label}, completá tanto el nombre como el valor.` };**

&#x20; **}**

&#x20; **if (name.length > 256 || value.length > 1024) {**

&#x20;   **return { field: null, error: `El campo ${label} supera el límite: el nombre admite 256 caracteres y el valor 1024.` };**

&#x20; **}**

&#x20; **return { field: { name, value, inline: false }, error: null };**

**}**

**function buildEmbedRoleComponents(userId, selectedRoleId = null) {**

&#x20; **const roleSelect = new RoleSelectMenuBuilder()**

&#x20;   **.setCustomId(`sae\_embed\_role:${userId}`)**

&#x20;   **.setPlaceholder('Elegir rol para mencionar (opcional)')**

&#x20;   **.setMaxValues(1);**

&#x20; **if (selectedRoleId) roleSelect.setDefaultRoles(selectedRoleId);**

&#x20; **const buttons = new ActionRowBuilder().addComponents(**

&#x20;   **new ButtonBuilder()**

&#x20;     **.setCustomId(`sae\_embed\_remove\_role:${userId}`)**

&#x20;     **.setLabel('Sin mención')**

&#x20;     **.setStyle(ButtonStyle.Secondary),**

&#x20;   **new ButtonBuilder()**

&#x20;     **.setCustomId(`sae\_embed\_continue:${userId}`)**

&#x20;     **.setLabel('Continuar')**

&#x20;     **.setStyle(ButtonStyle.Primary)**

&#x20; **);**

&#x20; **return \[new ActionRowBuilder().addComponents(roleSelect), buttons];**

**}**

**function buildEmbedFieldActionRow(userId) {**

&#x20; **return new ActionRowBuilder().addComponents(**

&#x20;   **new ButtonBuilder()**

&#x20;     **.setCustomId(`sae\_embed\_addfields:${userId}`)**

&#x20;     **.setLabel('Agregar campos')**

&#x20;     **.setStyle(ButtonStyle.Secondary),**

&#x20;   **new ButtonBuilder()**

&#x20;     **.setCustomId(`sae\_embed\_publish:${userId}`)**

&#x20;     **.setLabel('Publicar embed')**

&#x20;     **.setStyle(ButtonStyle.Success),**

&#x20;   **new ButtonBuilder()**

&#x20;     **.setCustomId(`sae\_embed\_cancel:${userId}`)**

&#x20;     **.setLabel('Cancelar')**

&#x20;     **.setStyle(ButtonStyle.Danger)**

&#x20; **);**

**}**

**function buildAddEmbedFieldsModal(userId) {**

&#x20; **const modal = new ModalBuilder()**

&#x20;   **.setCustomId(`sae\_embed\_addfields\_submit:${userId}`)**

&#x20;   **.setTitle('Agregar campos al embed');**

&#x20; **const components = \[];**

&#x20; **for (let i = 1; i <= 2; i++) {**

&#x20;   **const nameInput = new TextInputBuilder()**

&#x20;     **.setCustomId(`embed\_extra${i}\_name`)**

&#x20;     **.setLabel(`Nombre del campo ${i}`)**

&#x20;     **.setPlaceholder('Ej.: Precio, Horario, Información...')**

&#x20;     **.setStyle(TextInputStyle.Short)**

&#x20;     **.setMaxLength(256)**

&#x20;     **.setRequired(false);**

&#x20;   **const valueInput = new TextInputBuilder()**

&#x20;     **.setCustomId(`embed\_extra${i}\_value`)**

&#x20;     **.setLabel(`Valor del campo ${i}`)**

&#x20;     **.setStyle(TextInputStyle.Paragraph)**

&#x20;     **.setMaxLength(1024)**

&#x20;     **.setRequired(false);**

&#x20;   **components.push(new ActionRowBuilder().addComponents(nameInput));**

&#x20;   **components.push(new ActionRowBuilder().addComponents(valueInput));**

&#x20; **}**

&#x20; **modal.addComponents(...components);**

&#x20; **return modal;**

**}**

**// CLIENTE DE DISCORD**

**const client = new Client({**

&#x20; **intents: \[**

&#x20;   **GatewayIntentBits.Guilds,**

&#x20;   **GatewayIntentBits.GuildMessages,**

&#x20;   **GatewayIntentBits.GuildMembers,**

&#x20;   **GatewayIntentBits.MessageContent**

&#x20; **],**

&#x20; **partials: \[Partials.Channel]**

**});**

**// INTERACCIONES**

**client.on(Events.InteractionCreate, async interaction => {**

&#x20; **try {**

&#x20;   **// ====================================================**

&#x20;   **// /EMBED SIMPLE: color, título y descripción**

&#x20;   **// ====================================================**

&#x20;   **if (interaction.isChatInputCommand() \&\& interaction.commandName === 'embed') {**

&#x20;     **if (!(await ensureOwner(interaction))) return;**

&#x20;     **const channel = interaction.options.getChannel('canal');**

&#x20;     **if (**

&#x20;       **!channel ||**

&#x20;       **!\[ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)**

&#x20;     **) {**

&#x20;       **return interaction.reply({**

&#x20;         **content: 'Elegí un canal de texto válido.',**

&#x20;         **ephemeral: true**

&#x20;       **});**

&#x20;     **}**

&#x20;     **const modal = new ModalBuilder()**

&#x20;       **.setCustomId(`sae\_embed\_simple:${interaction.user.id}:${channel.id}`)**

&#x20;       **.setTitle('Crear embed');**

&#x20;     **const colorInput = new TextInputBuilder()**

&#x20;       **.setCustomId('embed\_simple\_color')**

&#x20;       **.setLabel('Color (nombre o HEX)')**

&#x20;       **.setPlaceholder('Morado, rojo, azul o #5865F2')**

&#x20;       **.setStyle(TextInputStyle.Short)**

&#x20;       **.setMaxLength(30)**

&#x20;       **.setRequired(false);**

&#x20;     **const titleInput = new TextInputBuilder()**

&#x20;       **.setCustomId('embed\_simple\_title')**

&#x20;       **.setLabel('Título')**

&#x20;       **.setStyle(TextInputStyle.Short)**

&#x20;       **.setMaxLength(256)**

&#x20;       **.setRequired(false);**

&#x20;     **const descriptionInput = new TextInputBuilder()**

&#x20;       **.setCustomId('embed\_simple\_description')**

&#x20;       **.setLabel('Descripción')**

&#x20;       **.setStyle(TextInputStyle.Paragraph)**

&#x20;       **.setMaxLength(4000)**

&#x20;       **.setRequired(false);**

&#x20;     **modal.addComponents(**

&#x20;       **new ActionRowBuilder().addComponents(colorInput),**

&#x20;       **new ActionRowBuilder().addComponents(titleInput),**

&#x20;       **new ActionRowBuilder().addComponents(descriptionInput)**

&#x20;     **);**

&#x20;     **return interaction.showModal(modal);**

&#x20;   **}**

&#x20;   **if (interaction.isModalSubmit() \&\& interaction.customId.startsWith('sae\_embed\_simple:')) {**

&#x20;     **const \[, ownerId, channelId] = interaction.customId.split(':');**

&#x20;     **if (interaction.user.id !== ownerId) {**

&#x20;       **return interaction.reply({ content: 'Este formulario pertenece a otro usuario.', ephemeral: true });**

&#x20;     **}**

&#x20;     **if (!(await ensureOwner(interaction))) return;**

&#x20;     **const colorText = interaction.fields.getTextInputValue('embed\_simple\_color').trim();**

&#x20;     **const title = interaction.fields.getTextInputValue('embed\_simple\_title').trim();**

&#x20;     **const description = interaction.fields.getTextInputValue('embed\_simple\_description').trim();**

&#x20;     **const color = resolveEmbedColor(colorText);**

&#x20;     **if (color === null) {**

&#x20;       **return interaction.reply({**

&#x20;         **content: 'Color no válido. Usá un nombre conocido (por ejemplo, morado o azul) o un HEX como #5865F2.',**

&#x20;         **ephemeral: true**

&#x20;       **});**

&#x20;     **}**

&#x20;     **if (!title \&\& !description) {**

&#x20;       **return interaction.reply({ content: 'Completá al menos el título o la descripción.', ephemeral: true });**

&#x20;     **}**

&#x20;     **const channel = await client.channels.fetch(channelId).catch(() => null);**

&#x20;     **if (**

&#x20;       **!channel ||**

&#x20;       **!\[ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)**

&#x20;     **) {**

&#x20;       **return interaction.reply({ content: 'No pude encontrar el canal de texto seleccionado.', ephemeral: true });**

&#x20;     **}**

&#x20;     **const embed = new EmbedBuilder().setColor(color);**

&#x20;     **if (title) embed.setTitle(title);**

&#x20;     **if (description) embed.setDescription(description);**

&#x20;     **const message = await channel.send({ embeds: \[embed], allowedMentions: { parse: \[] } });**

&#x20;     **return interaction.reply({**

&#x20;       **content: `Embed publicado correctamente: ${message.url}`,**

&#x20;       **ephemeral: true**

&#x20;     **});**

&#x20;   **}**

&#x20;   **// FORMULARIO 1: guardar diseño y mostrar selector de rol opcional.**

&#x20;   **if (interaction.isModalSubmit() \&\& interaction.customId.startsWith('sae\_embed\_step1:')) {**

&#x20;     **const \[, ownerId, channelId] = interaction.customId.split(':');**

&#x20;     **if (interaction.user.id !== ownerId) {**

&#x20;       **return interaction.reply({ content: '❌ Este formulario pertenece a otro usuario.', ephemeral: true });**

&#x20;     **}**

&#x20;     **if (!(await ensureOwner(interaction))) return;**

&#x20;     **const title = interaction.fields.getTextInputValue('embed\_title').trim();**

&#x20;     **const description = interaction.fields.getTextInputValue('embed\_description').trim();**

&#x20;     **const rawColor = interaction.fields.getTextInputValue('embed\_color').trim();**

&#x20;     **const imageUrl = interaction.fields.getTextInputValue('embed\_image').trim();**

&#x20;     **const footer = interaction.fields.getTextInputValue('embed\_footer').trim();**

&#x20;     **const color = resolveEmbedColor(rawColor);**

&#x20;     **if (rawColor \&\& color === null) {**

&#x20;       **return interaction.reply({**

&#x20;         **content: '❌ No reconozco ese color. Probá con morado, rojo, azul, verde, amarillo, naranja, rosa, negro, blanco, gris, celeste, turquesa, cian, magenta o dorado.',**

&#x20;         **ephemeral: true**

&#x20;       **});**

&#x20;     **}**

&#x20;     **if (imageUrl \&\& !isValidHttpUrl(imageUrl)) {**

&#x20;       **return interaction.reply({**

&#x20;         **content: '❌ La imagen debe tener una URL válida que empiece con `http://` o `https://`.',**

&#x20;         **ephemeral: true**

&#x20;       **});**

&#x20;     **}**

&#x20;     **const draftKey = `${interaction.guildId}:${interaction.user.id}`;**

&#x20;     **embedDrafts.set(draftKey, {**

&#x20;       **guildId: interaction.guildId,**

&#x20;       **userId: interaction.user.id,**

&#x20;       **channelId,**

&#x20;       **title,**

&#x20;       **description,**

&#x20;       **color,**

&#x20;       **imageUrl,**

&#x20;       **footer,**

&#x20;       **link: '',**

&#x20;       **fields: \[],**

&#x20;       **pingRoleId: null**

&#x20;     **});**

&#x20;     **return interaction.reply({**

&#x20;       **content: '✅ Diseño guardado. Elegí un rol en el selector si querés mencionarlo. \*\*@everyone no se puede mencionar desde este constructor.\*\* Después pulsá Continuar.',**

&#x20;       **components: buildEmbedRoleComponents(interaction.user.id),**

&#x20;       **ephemeral: true**

&#x20;     **});**

&#x20;   **}**

&#x20;   **// SELECTOR DE ROL: permite escoger un único rol real del servidor.**

&#x20;   **if (interaction.isRoleSelectMenu() \&\& interaction.customId.startsWith('sae\_embed\_role:')) {**

&#x20;     **const ownerId = interaction.customId.split(':')\[1];**

&#x20;     **if (interaction.user.id !== ownerId) {**

&#x20;       **return interaction.reply({ content: '❌ Este selector pertenece a otro usuario.', ephemeral: true });**

&#x20;     **}**

&#x20;     **if (!(await ensureOwner(interaction))) return;**

&#x20;     **const draftKey = `${interaction.guildId}:${interaction.user.id}`;**

&#x20;     **const draft = embedDrafts.get(draftKey);**

&#x20;     **if (!draft || draft.userId !== interaction.user.id || draft.guildId !== interaction.guildId) {**

&#x20;       **return interaction.reply({ content: '❌ No encontré el embed en preparación. Ejecutá `/embed` otra vez.', ephemeral: true });**

&#x20;     **}**

&#x20;     **const roleId = interaction.values?.\[0];**

&#x20;     **if (!roleId) {**

&#x20;       **draft.pingRoleId = null;**

&#x20;       **return interaction.update({**

&#x20;         **content: '✅ No se mencionará ningún rol. \*\*@everyone no está permitido.\*\* Podés continuar cuando quieras.',**

&#x20;         **components: buildEmbedRoleComponents(interaction.user.id, null)**

&#x20;       **});**

&#x20;     **}**

&#x20;     **if (roleId === interaction.guild.id) {**

&#x20;       **return interaction.reply({ content: '❌ No se puede seleccionar ni mencionar @everyone.', ephemeral: true });**

&#x20;     **}**

&#x20;     **const role = await interaction.guild.roles.fetch(roleId).catch(() => null);**

&#x20;     **if (!role || role.id === interaction.guild.id) {**

&#x20;       **return interaction.reply({ content: '❌ Ese rol no es válido para mencionar.', ephemeral: true });**

&#x20;     **}**

&#x20;     **draft.pingRoleId = role.id;**

&#x20;     **return interaction.update({**

&#x20;       **content: `✅ Rol seleccionado para mencionar: ${role}. @everyone está bloqueado. Pulsá Continuar cuando termines.`,**

&#x20;       **components: buildEmbedRoleComponents(interaction.user.id, draft.pingRoleId)**

&#x20;     **});**

&#x20;   **}**

&#x20;   **// Quitar la mención elegida.**

&#x20;   **if (interaction.isButton() \&\& interaction.customId.startsWith('sae\_embed\_remove\_role:')) {**

&#x20;     **const ownerId = interaction.customId.split(':')\[1];**

&#x20;     **if (interaction.user.id !== ownerId) {**

&#x20;       **return interaction.reply({ content: '❌ Este botón pertenece a otro usuario.', ephemeral: true });**

&#x20;     **}**

&#x20;     **if (!(await ensureOwner(interaction))) return;**

&#x20;     **const draft = embedDrafts.get(`${interaction.guildId}:${interaction.user.id}`);**

&#x20;     **if (!draft) return interaction.reply({ content: '❌ No encontré el embed en preparación.', ephemeral: true });**

&#x20;     **draft.pingRoleId = null;**

&#x20;     **return interaction.update({**

&#x20;       **content: '✅ Listo: no se mencionará ningún rol. Pulsá Continuar para seguir.',**

&#x20;       **components: buildEmbedRoleComponents(interaction.user.id, null)**

&#x20;     **});**

&#x20;   **}**

&#x20;   **// BOTÓN PARA ABRIR EL FORMULARIO CON ENLACE Y DOS CAMPOS NORMALES.**

&#x20;   **if (interaction.isButton() \&\& interaction.customId.startsWith('sae\_embed\_continue:')) {**

&#x20;     **const ownerId = interaction.customId.split(':')\[1];**

&#x20;     **if (interaction.user.id !== ownerId) {**

&#x20;       **return interaction.reply({ content: '❌ Este botón pertenece a otro usuario.', ephemeral: true });**

&#x20;     **}**

&#x20;     **if (!(await ensureOwner(interaction))) return;**

&#x20;     **const draft = embedDrafts.get(`${interaction.guildId}:${interaction.user.id}`);**

&#x20;     **if (!draft || draft.guildId !== interaction.guildId || draft.userId !== interaction.user.id) {**

&#x20;       **return interaction.reply({ content: '❌ No encontré el primer formulario. Ejecutá `/embed` otra vez.', ephemeral: true });**

&#x20;     **}**

&#x20;     **const modal = new ModalBuilder()**

&#x20;       **.setCustomId(`sae\_embed\_step2:${interaction.user.id}`)**

&#x20;       **.setTitle('Enlace y campos · 2/2');**

&#x20;     **const linkInput = new TextInputBuilder()**

&#x20;       **.setCustomId('embed\_link')**

&#x20;       **.setLabel('Enlace del título (opcional)')**

&#x20;       **.setPlaceholder('https://...')**

&#x20;       **.setStyle(TextInputStyle.Short)**

&#x20;       **.setMaxLength(400)**

&#x20;       **.setRequired(false);**

&#x20;     **const field1Name = new TextInputBuilder()**

&#x20;       **.setCustomId('embed\_field1\_name')**

&#x20;       **.setLabel('Nombre del campo 1')**

&#x20;       **.setPlaceholder('Ej.: Precio, Horario, Información...')**

&#x20;       **.setStyle(TextInputStyle.Short)**

&#x20;       **.setMaxLength(256)**

&#x20;       **.setRequired(false);**

&#x20;     **const field1Value = new TextInputBuilder()**

&#x20;       **.setCustomId('embed\_field1\_value')**

&#x20;       **.setLabel('Valor del campo 1')**

&#x20;       **.setStyle(TextInputStyle.Paragraph)**

&#x20;       **.setMaxLength(1024)**

&#x20;       **.setRequired(false);**

&#x20;     **const field2Name = new TextInputBuilder()**

&#x20;       **.setCustomId('embed\_field2\_name')**

&#x20;       **.setLabel('Nombre del campo 2')**

&#x20;       **.setStyle(TextInputStyle.Short)**

&#x20;       **.setMaxLength(256)**

&#x20;       **.setRequired(false);**

&#x20;     **const field2Value = new TextInputBuilder()**

&#x20;       **.setCustomId('embed\_field2\_value')**

&#x20;       **.setLabel('Valor del campo 2')**

&#x20;       **.setStyle(TextInputStyle.Paragraph)**

&#x20;       **.setMaxLength(1024)**

&#x20;       **.setRequired(false);**

&#x20;     **modal.addComponents(**

&#x20;       **new ActionRowBuilder().addComponents(linkInput),**

&#x20;       **new ActionRowBuilder().addComponents(field1Name),**

&#x20;       **new ActionRowBuilder().addComponents(field1Value),**

&#x20;       **new ActionRowBuilder().addComponents(field2Name),**

&#x20;       **new ActionRowBuilder().addComponents(field2Value)**

&#x20;     **);**

&#x20;     **return interaction.showModal(modal);**

&#x20;   **}**

&#x20;   **// GUARDAR ENLACE Y LOS CAMPOS DEL SEGUNDO FORMULARIO.**

&#x20;   **if (interaction.isModalSubmit() \&\& interaction.customId.startsWith('sae\_embed\_step2:')) {**

&#x20;     **const ownerId = interaction.customId.split(':')\[1];**

&#x20;     **if (interaction.user.id !== ownerId) {**

&#x20;       **return interaction.reply({ content: '❌ Este formulario pertenece a otro usuario.', ephemeral: true });**

&#x20;     **}**

&#x20;     **if (!(await ensureOwner(interaction))) return;**

&#x20;     **const draftKey = `${interaction.guildId}:${interaction.user.id}`;**

&#x20;     **const draft = embedDrafts.get(draftKey);**

&#x20;     **if (!draft || draft.guildId !== interaction.guildId || draft.userId !== interaction.user.id) {**

&#x20;       **return interaction.reply({ content: '❌ No encontré el primer formulario. Ejecutá `/embed` otra vez.', ephemeral: true });**

&#x20;     **}**

&#x20;     **const link = interaction.fields.getTextInputValue('embed\_link').trim();**

&#x20;     **if (link \&\& !isValidHttpUrl(link)) {**

&#x20;       **return interaction.reply({ content: '❌ El enlace tiene que empezar con `http://` o `https://`. Pulsá Continuar para corregirlo.', ephemeral: true });**

&#x20;     **}**

&#x20;     **const pair1 = readEmbedFieldPair(interaction, 'embed\_field1\_name', 'embed\_field1\_value', '1');**

&#x20;     **const pair2 = readEmbedFieldPair(interaction, 'embed\_field2\_name', 'embed\_field2\_value', '2');**

&#x20;     **const fieldError = pair1.error || pair2.error;**

&#x20;     **if (fieldError) {**

&#x20;       **return interaction.reply({ content: `❌ ${fieldError} Pulsá Continuar para corregirlo.`, ephemeral: true });**

&#x20;     **}**

&#x20;     **const newFields = \[pair1.field, pair2.field].filter(Boolean);**

&#x20;     **if (draft.fields.length + newFields.length > 25) {**

&#x20;       **return interaction.reply({ content: '❌ Un embed admite como máximo 25 campos.', ephemeral: true });**

&#x20;     **}**

&#x20;     **draft.link = link;**

&#x20;     **draft.fields.push(...newFields);**

&#x20;     **const roleSummary = draft.pingRoleId ? `Rol que se mencionará: <@\&${draft.pingRoleId}>.` : 'No se mencionará ningún rol.';**

&#x20;     **return interaction.reply({**

&#x20;       **content: `✅ Guardado. Campos: \*\*${draft.fields.length}/25\*\*. ${roleSummary}\\nPodés agregar más campos o publicar el embed. @everyone no está permitido.`,**

&#x20;       **components: \[buildEmbedFieldActionRow(interaction.user.id)],**

&#x20;       **ephemeral: true**

&#x20;     **});**

&#x20;   **}**

&#x20;   **// AGREGAR CAMPOS EXTRA, EN PARES DE NOMBRE Y VALOR.**

&#x20;   **if (interaction.isButton() \&\& interaction.customId.startsWith('sae\_embed\_addfields:')) {**

&#x20;     **const ownerId = interaction.customId.split(':')\[1];**

&#x20;     **if (interaction.user.id !== ownerId) {**

&#x20;       **return interaction.reply({ content: '❌ Este botón pertenece a otro usuario.', ephemeral: true });**

&#x20;     **}**

&#x20;     **if (!(await ensureOwner(interaction))) return;**

&#x20;     **const draft = embedDrafts.get(`${interaction.guildId}:${interaction.user.id}`);**

&#x20;     **if (!draft || draft.guildId !== interaction.guildId) {**

&#x20;       **return interaction.reply({ content: '❌ No encontré el embed en preparación.', ephemeral: true });**

&#x20;     **}**

&#x20;     **if (draft.fields.length >= 25) {**

&#x20;       **return interaction.reply({ content: '❌ Ya llegaste al límite de 25 campos.', ephemeral: true });**

&#x20;     **}**

&#x20;     **return interaction.showModal(buildAddEmbedFieldsModal(interaction.user.id));**

&#x20;   **}**

&#x20;   **if (interaction.isModalSubmit() \&\& interaction.customId.startsWith('sae\_embed\_addfields\_submit:')) {**

&#x20;     **const ownerId = interaction.customId.split(':')\[1];**

&#x20;     **if (interaction.user.id !== ownerId) {**

&#x20;       **return interaction.reply({ content: '❌ Este formulario pertenece a otro usuario.', ephemeral: true });**

&#x20;     **}**

&#x20;     **if (!(await ensureOwner(interaction))) return;**

&#x20;     **const draftKey = `${interaction.guildId}:${interaction.user.id}`;**

&#x20;     **const draft = embedDrafts.get(draftKey);**

&#x20;     **if (!draft || draft.guildId !== interaction.guildId) {**

&#x20;       **return interaction.reply({ content: '❌ No encontré el embed en preparación.', ephemeral: true });**

&#x20;     **}**

&#x20;     **const pair1 = readEmbedFieldPair(interaction, 'embed\_extra1\_name', 'embed\_extra1\_value', '1');**

&#x20;     **const pair2 = readEmbedFieldPair(interaction, 'embed\_extra2\_name', 'embed\_extra2\_value', '2');**

&#x20;     **const fieldError = pair1.error || pair2.error;**

&#x20;     **if (fieldError) {**

&#x20;       **return interaction.reply({ content: `❌ ${fieldError} Volvé a pulsar \*\*Agregar campos\*\* para intentarlo otra vez.`, components: \[buildEmbedFieldActionRow(interaction.user.id)], ephemeral: true });**

&#x20;     **}**

&#x20;     **const newFields = \[pair1.field, pair2.field].filter(Boolean);**

&#x20;     **if (newFields.length === 0) {**

&#x20;       **return interaction.reply({ content: 'No agregaste ningún campo. Podés probar otra vez o publicar el embed como está.', components: \[buildEmbedFieldActionRow(interaction.user.id)], ephemeral: true });**

&#x20;     **}**

&#x20;     **if (draft.fields.length + newFields.length > 25) {**

&#x20;       **return interaction.reply({ content: `❌ Ya hay ${draft.fields.length} campos. El límite de Discord es 25; agregá como máximo ${25 - draft.fields.length}.`, components: \[buildEmbedFieldActionRow(interaction.user.id)], ephemeral: true });**

&#x20;     **}**

&#x20;     **draft.fields.push(...newFields);**

&#x20;     **const roleSummary = draft.pingRoleId ? `Rol que se mencionará: <@\&${draft.pingRoleId}>.` : 'No se mencionará ningún rol.';**

&#x20;     **return interaction.reply({**

&#x20;       **content: `✅ Campos guardados: \*\*${draft.fields.length}/25\*\*. ${roleSummary}\\nPodés agregar más campos o publicar el embed.`,**

&#x20;       **components: \[buildEmbedFieldActionRow(interaction.user.id)],**

&#x20;       **ephemeral: true**

&#x20;     **});**

&#x20;   **}**

&#x20;   **// PUBLICAR EMBED; SOLO SE PUEDE MENCIONAR EL ROL ELEGIDO EN EL SELECTOR.**

&#x20;   **if (interaction.isButton() \&\& interaction.customId.startsWith('sae\_embed\_publish:')) {**

&#x20;     **const ownerId = interaction.customId.split(':')\[1];**

&#x20;     **if (interaction.user.id !== ownerId) {**

&#x20;       **return interaction.reply({ content: '❌ Este botón pertenece a otro usuario.', ephemeral: true });**

&#x20;     **}**

&#x20;     **if (!(await ensureOwner(interaction))) return;**

&#x20;     **const draftKey = `${interaction.guildId}:${interaction.user.id}`;**

&#x20;     **const draft = embedDrafts.get(draftKey);**

&#x20;     **if (!draft || draft.guildId !== interaction.guildId || draft.userId !== interaction.user.id) {**

&#x20;       **return interaction.reply({ content: '❌ No encontré el embed en preparación. Ejecutá `/embed` otra vez.', ephemeral: true });**

&#x20;     **}**

&#x20;     **await interaction.deferReply({ ephemeral: true });**

&#x20;     **const channel = await client.channels.fetch(draft.channelId).catch(() => null);**

&#x20;     **if (!channel || !\[ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type) || !channel.isTextBased()) {**

&#x20;       **return interaction.editReply({ content: '❌ El canal elegido ya no existe o no permite enviar mensajes.' });**

&#x20;     **}**

&#x20;     **let role = null;**

&#x20;     **if (draft.pingRoleId) {**

&#x20;       **if (draft.pingRoleId === interaction.guild.id) {**

&#x20;         **return interaction.editReply({ content: '❌ @everyone está bloqueado. Volvé a crear el embed y elegí un rol concreto.' });**

&#x20;       **}**

&#x20;       **role = await interaction.guild.roles.fetch(draft.pingRoleId).catch(() => null);**

&#x20;       **if (!role || role.id === interaction.guild.id) {**

&#x20;         **return interaction.editReply({ content: '❌ El rol seleccionado ya no existe o no se puede mencionar. Volvé a crear el embed.' });**

&#x20;       **}**

&#x20;       **const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe().catch(() => null);**

&#x20;       **const canMentionRole = role.mentionable || Boolean(**

&#x20;         **botMember \&\& channel.permissionsFor(botMember)?.has(PermissionFlagsBits.MentionEveryone)**

&#x20;       **);**

&#x20;       **if (!canMentionRole) {**

&#x20;         **return interaction.editReply({**

&#x20;           **content: `❌ No puedo mencionar ${role} porque no es un rol mencionable y el bot no tiene permiso para mencionar roles en ${channel}. Elegí un rol mencionable o ajustá sus permisos. @everyone seguirá bloqueado.`**

&#x20;         **});**

&#x20;       **}**

&#x20;     **}**

&#x20;     **const embed = new EmbedBuilder().setColor(draft.color);**

&#x20;     **if (draft.title) embed.setTitle(draft.title);**

&#x20;     **if (draft.description) embed.setDescription(draft.description);**

&#x20;     **if (draft.imageUrl) embed.setImage(draft.imageUrl);**

&#x20;     **if (draft.footer) embed.setFooter({ text: draft.footer });**

&#x20;     **if (draft.fields.length) embed.addFields(draft.fields);**

&#x20;     **if (draft.link \&\& draft.title) {**

&#x20;       **embed.setURL(draft.link);**

&#x20;     **} else if (draft.link) {**

&#x20;       **embed.setDescription(\[draft.description, `\[Abrir enlace](${draft.link})`].filter(Boolean).join('\\n\\n'));**

&#x20;     **}**

&#x20;     **if (!draft.title \&\& !draft.description \&\& !draft.imageUrl \&\& !draft.footer \&\& !draft.link \&\& draft.fields.length === 0) {**

&#x20;       **return interaction.editReply({ content: '❌ El embed está vacío. Volvé a `/embed` y agregá título, descripción, imagen, pie o campos.' });**

&#x20;     **}**

&#x20;     **const totalEmbedCharacters =**

&#x20;       **(draft.title || '').length +**

&#x20;       **(draft.description || '').length +**

&#x20;       **(draft.footer || '').length +**

&#x20;       **draft.fields.reduce((total, field) => total + field.name.length + field.value.length, 0);**

&#x20;     **if (totalEmbedCharacters > 6000) {**

&#x20;       **return interaction.editReply({ content: `❌ El embed supera los 6000 caracteres permitidos (ahora tiene ${totalEmbedCharacters}). Reducí el texto antes de publicarlo.` });**

&#x20;     **}**

&#x20;     **const payload = {**

&#x20;       **embeds: \[embed],**

&#x20;       **allowedMentions: role ? { parse: \[], roles: \[role.id] } : { parse: \[], roles: \[] }**

&#x20;     **};**

&#x20;     **if (role) payload.content = `<@\&${role.id}>`;**

&#x20;     **const message = await channel.send(payload);**

&#x20;     **embedDrafts.delete(draftKey);**

&#x20;     **return interaction.editReply({ content: `✅ Embed publicado en ${channel}. \[Ver mensaje](${message.url})` });**

&#x20;   **}**

&#x20;   **// CANCELAR Y BORRAR EL BORRADOR.**

&#x20;   **if (interaction.isButton() \&\& interaction.customId.startsWith('sae\_embed\_cancel:')) {**

&#x20;     **const ownerId = interaction.customId.split(':')\[1];**

&#x20;     **if (interaction.user.id !== ownerId) {**

&#x20;       **return interaction.reply({ content: '❌ Este botón pertenece a otro usuario.', ephemeral: true });**

&#x20;     **}**

&#x20;     **if (!(await ensureOwner(interaction))) return;**

&#x20;     **embedDrafts.delete(`${interaction.guildId}:${interaction.user.id}`);**

&#x20;     **return interaction.update({ content: '🗑️ Se canceló el constructor y se borró el borrador.', components: \[] });**

&#x20;   **}**

&#x20;   **// BOT GUARDIAN: comandos administrativos**

&#x20;   **if (interaction.isChatInputCommand() \&\& \['warn', 'documentacion', 'sendmessage'].includes(interaction.commandName)) {**

&#x20;     **if (!interaction.inGuild() || !interaction.guild || !guardianIsAllowedGuild(interaction)) {**

&#x20;       **await interaction.reply({ content: 'Este comando solo está habilitado en el servidor configurado.', flags: MessageFlags.Ephemeral });**

&#x20;       **return;**

&#x20;     **}**

&#x20;     **const command = interaction.commandName;**

&#x20;     **const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);**

&#x20;     **const allowed = command === 'warn' ? guardianCanWarn(member) : guardianCanAdmin(member);**

&#x20;     **if (!allowed) {**

&#x20;       **await interaction.reply({ content: 'No tienes autorización para utilizar este comando.', flags: MessageFlags.Ephemeral });**

&#x20;       **return;**

&#x20;     **}**

&#x20;     **if (command === 'warn') {**

&#x20;       **const user = interaction.options.getUser('usuario', true);**

&#x20;       **const reason = interaction.options.getString('motivo', true).trim();**

&#x20;       **if (user.bot) {**

&#x20;         **await interaction.reply({ content: 'No se pueden registrar advertencias para bots.', flags: MessageFlags.Ephemeral });**

&#x20;         **return;**

&#x20;       **}**

&#x20;       **const result = await guardianAddWarning(interaction.guild, user, reason, 'manual');**

&#x20;       **await interaction.reply({**

&#x20;         **embeds: \[new EmbedBuilder().setColor(0x475569).setTitle('Advertencia registrada').setDescription(**

&#x20;           **`Usuario: ${user.tag}\\nTotal de advertencias: ${result.total}\\nMotivo: ${reason}\\nSanción: ${result.sanction}`**

&#x20;         **).setTimestamp(new Date())],**

&#x20;         **flags: MessageFlags.Ephemeral,**

&#x20;         **allowedMentions: { parse: \[] }**

&#x20;       **});**

&#x20;       **return;**

&#x20;     **}**

&#x20;     **if (command === 'documentacion') {**

&#x20;       **const user = interaction.options.getUser('usuario', true);**

&#x20;       **const warnings = getGuardianUserRecord(interaction.guildId, user.id);**

&#x20;       **const recent = warnings.slice(-15);**

&#x20;       **const startNumber = warnings.length - recent.length;**

&#x20;       **const details = recent.map((warning, index) => {**

&#x20;         **const date = new Date(warning.createdAt).toLocaleString('es-UY', { timeZone: 'America/Montevideo' });**

&#x20;         **return `${startNumber + index + 1}. Motivo: ${warning.reason}\\n   Fecha: ${date}`;**

&#x20;       **});**

&#x20;       **const description = `Usuario: ${user.tag} (${user.id})\\nTotal: ${warnings.length} WARNS\\n\\n` +**

&#x20;         **(details.length ? details.join('\\n\\n') : 'No hay advertencias registradas.');**

&#x20;       **await interaction.reply({**

&#x20;         **embeds: \[new EmbedBuilder().setColor(warnings.length ? 0xB45309 : 0x475569).setTitle('Documentación del usuario').setDescription(description).setTimestamp(new Date())],**

&#x20;         **flags: MessageFlags.Ephemeral,**

&#x20;         **allowedMentions: { parse: \[] }**

&#x20;       **});**

&#x20;       **return;**

&#x20;     **}**

&#x20;     **const channel = interaction.options.getChannel('canal') || interaction.channel;**

&#x20;     **if (!channel?.isTextBased() || !channel.isSendable()) {**

&#x20;       **await interaction.reply({ content: 'No se encontró un canal de texto válido para el envío.', flags: MessageFlags.Ephemeral });**

&#x20;       **return;**

&#x20;     **}**

&#x20;     **if (command === 'sendmessage') {**

&#x20;       **const content = interaction.options.getString('contenido', true);**

&#x20;       **const userToMention = interaction.options.getUser('mencionar');**

&#x20;       **const attachment = interaction.options.getAttachment('archivo');**

&#x20;       **const text = `${userToMention ? `<@${userToMention.id}>\\n` : ''}${content}`;**

&#x20;       **try {**

&#x20;         **await channel.send({**

&#x20;           **content: text,**

&#x20;           **files: attachment ? \[{ attachment: attachment.url, name: attachment.name }] : \[],**

&#x20;           **allowedMentions: userToMention ? { users: \[userToMention.id], parse: \[] } : { parse: \[] }**

&#x20;         **});**

&#x20;         **await interaction.reply({ content: 'El mensaje se ha enviado correctamente.', flags: MessageFlags.Ephemeral });**

&#x20;       **} catch (error) {**

&#x20;         **console.error('BOT GUARDIAN /sendmessage:', error);**

&#x20;         **await interaction.reply({ content: 'No se pudo enviar el mensaje. Comprueba los permisos del bot y el archivo adjunto.', flags: MessageFlags.Ephemeral });**

&#x20;       **}**

&#x20;       **return;**

&#x20;     **}**

&#x20;   **}**

**// /ADDPREDICTION**

&#x20;   **if (**

&#x20;     **interaction.isChatInputCommand() \&\&**

&#x20;     **interaction.commandName === 'addprediction'**

&#x20;   **) {**

&#x20;     **if (!(await ensureOwner(interaction))) return;**

&#x20;     **await interaction.reply({**

&#x20;       **content: '👑 \*\*ADDPREDICTION\*\*\\n\\n¿Qué personaje querés predecir?',**

&#x20;       **components: buildDivineSelectRows(interaction.user.id, 0),**

&#x20;       **ephemeral: true**

&#x20;     **});**

&#x20;     **return;**

&#x20;   **}**

**// PÁGINAS DEL MENÚ**

&#x20;   **if (**

&#x20;     **interaction.isButton() \&\&**

&#x20;     **interaction.customId.startsWith('addprediction\_page:')**

&#x20;   **) {**

&#x20;     **const parts = interaction.customId.split(':');**

&#x20;     **const ownerId = parts\[1];**

&#x20;     **const page = Number(parts\[2]);**

&#x20;     **if (interaction.user.id !== ownerId) {**

&#x20;       **await interaction.reply({**

&#x20;         **content: '❌ Este menú pertenece a otro usuario.',**

&#x20;         **ephemeral: true**

&#x20;       **});**

&#x20;       **return;**

&#x20;     **}**

&#x20;     **if (!(await ensureOwner(interaction))) return;**

&#x20;     **if (**

&#x20;       **!Number.isInteger(page) ||**

&#x20;       **page < 0 ||**

&#x20;       **page >= Math.ceil(config.divines.length / DIVINE\_PAGE\_SIZE)**

&#x20;     **) {**

&#x20;       **await interaction.reply({**

&#x20;         **content: '❌ Página inválida.',**

&#x20;         **ephemeral: true**

&#x20;       **});**

&#x20;       **return;**

&#x20;     **}**

&#x20;     **await interaction.update({**

&#x20;       **content: '👑 \*\*ADDPREDICTION\*\*\\n\\n¿Qué personaje querés predecir?',**

&#x20;       **components: buildDivineSelectRows(interaction.user.id, page)**

&#x20;     **});**

&#x20;     **return;**

&#x20;   **}**

**// ELEGIR DIVINE**

&#x20;   **if (**

&#x20;     **interaction.isStringSelectMenu() \&\&**

&#x20;     **interaction.customId.startsWith('addprediction\_divine:')**

&#x20;   **) {**

&#x20;     **const parts = interaction.customId.split(':');**

&#x20;     **const ownerId = parts\[1];**

&#x20;     **if (interaction.user.id !== ownerId) {**

&#x20;       **await interaction.reply({**

&#x20;         **content: '❌ Este menú pertenece a otro usuario.',**

&#x20;         **ephemeral: true**

&#x20;       **});**

&#x20;       **return;**

&#x20;     **}**

&#x20;     **if (!(await ensureOwner(interaction))) return;**

&#x20;     **const selectedKey = interaction.values\[0];**

&#x20;     **const divine = config.divines.find(**

&#x20;       **item => item.key === selectedKey**

&#x20;     **);**

&#x20;     **if (!divine) {**

&#x20;       **await interaction.reply({**

&#x20;         **content: '❌ No encontré ese Divine en config.json.',**

&#x20;         **ephemeral: true**

&#x20;       **});**

&#x20;       **return;**

&#x20;     **}**

&#x20;     **const modal = new ModalBuilder()**

&#x20;       **.setCustomId(**

&#x20;         **`addprediction\_modal:${interaction.user.id}:${encodeURIComponent(divine.key)}`**

&#x20;       **)**

&#x20;       **.setTitle('Añadir Divine Prediction');**

&#x20;     **const firstTimeInput = new TextInputBuilder()**

&#x20;       **.setCustomId('hora1')**

&#x20;       **.setLabel('Primer horario (HH:mm)')**

&#x20;       **.setPlaceholder('Ejemplo: 19:30')**

&#x20;       **.setStyle(TextInputStyle.Short)**

&#x20;       **.setMinLength(5)**

&#x20;       **.setMaxLength(5)**

&#x20;       **.setRequired(true);**

&#x20;     **const secondTimeInput = new TextInputBuilder()**

&#x20;       **.setCustomId('hora2')**

&#x20;       **.setLabel('Segundo horario (HH:mm)')**

&#x20;       **.setPlaceholder('Ejemplo: 23:30')**

&#x20;       **.setStyle(TextInputStyle.Short)**

&#x20;       **.setMinLength(5)**

&#x20;       **.setMaxLength(5)**

&#x20;       **.setRequired(true);**

&#x20;     **modal.addComponents(**

&#x20;       **new ActionRowBuilder().addComponents(firstTimeInput),**

&#x20;       **new ActionRowBuilder().addComponents(secondTimeInput)**

&#x20;     **);**

&#x20;     **await interaction.showModal(modal);**

&#x20;     **return;**

&#x20;   **}**

**// HORARIOS INTRODUCIDOS EN EL MODAL**

&#x20;   **if (**

&#x20;     **interaction.isModalSubmit() \&\&**

&#x20;     **interaction.customId.startsWith('addprediction\_modal:')**

&#x20;   **) {**

&#x20;     **const parts = interaction.customId.split(':');**

&#x20;     **const ownerId = parts\[1];**

&#x20;     **const divineKey = decodeURIComponent(parts.slice(2).join(':'));**

&#x20;     **if (interaction.user.id !== ownerId) {**

&#x20;       **await interaction.reply({**

&#x20;         **content: '❌ Este formulario pertenece a otro usuario.',**

&#x20;         **ephemeral: true**

&#x20;       **});**

&#x20;       **return;**

&#x20;     **}**

&#x20;     **if (!(await ensureOwner(interaction))) return;**

&#x20;     **const divine = config.divines.find(**

&#x20;       **item => item.key === divineKey**

&#x20;     **);**

&#x20;     **if (!divine) {**

&#x20;       **await interaction.reply({**

&#x20;         **content: '❌ No encontré ese Divine en config.json.',**

&#x20;         **ephemeral: true**

&#x20;       **});**

&#x20;       **return;**

&#x20;     **}**

&#x20;     **const firstInput = interaction.fields**

&#x20;       **.getTextInputValue('hora1')**

&#x20;       **.trim();**

&#x20;     **const secondInput = interaction.fields**

&#x20;       **.getTextInputValue('hora2')**

&#x20;       **.trim();**

&#x20;     **const firstTime = parseUpcomingClockTime(firstInput);**

&#x20;     **const secondTime = parseUpcomingClockTime(secondInput);**

&#x20;     **if (!firstTime || !secondTime) {**

&#x20;       **await interaction.reply({**

&#x20;         **content: '❌ Horario inválido. Usá HH:mm, por ejemplo \*\*09:05\*\*, \*\*17:30\*\* o \*\*23:55\*\*.',**

&#x20;         **ephemeral: true**

&#x20;       **});**

&#x20;       **return;**

&#x20;     **}**

&#x20;     **if (**

&#x20;       **firstTime.minute % 5 !== 0 ||**

&#x20;       **secondTime.minute % 5 !== 0**

&#x20;     **) {**

&#x20;       **await interaction.reply({**

&#x20;         **content: '❌ Los horarios deben estar en múltiplos de 5 minutos. Ejemplos: \*\*19:00\*\*, \*\*19:05\*\*, \*\*19:10\*\*, \*\*19:15\*\*.',**

&#x20;         **ephemeral: true**

&#x20;       **});**

&#x20;       **return;**

&#x20;     **}**

&#x20;     **const orderedTimes = \[**

&#x20;       **firstTime,**

&#x20;       **secondTime**

&#x20;     **].sort((a, b) => a.toMillis() - b.toMillis());**

&#x20;     **const channel = await client.channels.fetch(CHANNEL\_ID);**

&#x20;     **if (!channel || !channel.isTextBased()) {**

&#x20;       **throw new Error(**

&#x20;         **'PREDICTION\_CHANNEL\_ID no apunta a un canal de texto.'**

&#x20;       **);**

&#x20;     **}**

&#x20;     **const lastSeenData = await getSenzLastSeen(client);**

&#x20;     **const chance = getSenzDivineChance(divine, lastSeenData);**

&#x20;     **const embed = buildManualPredictionEmbed(**

&#x20;       **divine,**

&#x20;       **orderedTimes\[0],**

&#x20;       **orderedTimes\[1],**

&#x20;       **chance**

&#x20;     **);**

&#x20;     **const message = await channel.send({**

&#x20;       **content: `<@\&${PREDICTION\_ROLE\_ID}>`,**

&#x20;       **embeds: \[embed],**

&#x20;       **allowedMentions: {**

&#x20;         **parse: \[],**

&#x20;         **roles: \[PREDICTION\_ROLE\_ID]**

&#x20;       **}**

&#x20;     **});**

&#x20;     **await addDivineReactions(message);**

&#x20;     **await interaction.reply({**

&#x20;       **content:**

&#x20;         **`✅ Predicción publicada para \*\*${getDivineDisplay(divine)}\*\* en ${channel}.\\n` +**

&#x20;         **`\[Ver mensaje](${message.url})`,**

&#x20;       **ephemeral: true**

&#x20;     **});**

&#x20;     **console.log(**

&#x20;       **`✅ Predicción manual publicada: ${divine.key} — ${message.url}`**

&#x20;     **);**

&#x20;     **return;**

&#x20;   **}**

&#x20; **} catch (error) {**

&#x20;   **console.error('❌ Error procesando interacción:', error);**

&#x20;   **if (interaction.isRepliable()) {**

&#x20;     **const payload = {**

&#x20;       **content:**

&#x20;         **'❌ Hubo un error procesando la interacción. Revisá la consola; también puede faltar algún dato de SenZ.',**

&#x20;       **ephemeral: true**

&#x20;     **};**

&#x20;     **if (interaction.replied || interaction.deferred) {**

&#x20;       **await interaction.followUp(payload).catch(() => {});**

&#x20;     **} else {**

&#x20;       **await interaction.reply(payload).catch(() => {});**

&#x20;     **}**

&#x20;   **}**

&#x20; **}**

**});**

**// EVENTO READY**

**client.once(Events.ClientReady, async readyClient => {**

&#x20; **console.log(**

&#x20;   **`SAE PREDICTION conectado como ${readyClient.user.tag}`**

&#x20; **);**



&#x20; **startRadarKeepAlive();**

&#x20; 

&#x20; **readyClient.user.setActivity('SAE Predictions', {**

&#x20;   **type: ActivityType.Watching**

&#x20; **});**

&#x20; **await registerSlashCommands(readyClient);**

&#x20; **const now = DateTime.now().setZone(TIMEZONE);**

&#x20; **const scheduledToday = now.set({**

&#x20;   **hour: PREDICTION\_HOUR,**

&#x20;   **minute: PREDICTION\_MINUTE,**

&#x20;   **second: 0,**

&#x20;   **millisecond: 0**

&#x20; **});**

&#x20; **if (now >= scheduledToday) {**

&#x20;   **try {**

&#x20;     **await publishDailyPrediction(readyClient);**

&#x20;   **} catch (error) {**

&#x20;     **console.error(**

&#x20;       **'Error recuperando la predicción del día:',**

&#x20;       **error**

&#x20;     **);**

&#x20;   **}**

&#x20; **}**

&#x20; **console.log('✅ Sistema de predicciones listo.');**

&#x20; **console.log('✅ Sistema /addprediction cargado.');**

&#x20; **console.log(`🕒 Zona horaria: ${TIMEZONE}`);**

**});**

**// REPLICADOR DE PINGS DE SENZ V2**

**client.on(Events.MessageCreate, async message => {**

&#x20; **try {**

&#x20;   **if (**

&#x20;     **!message.guild ||**

&#x20;     **message.channelId !== SENZ\_PING\_CHANNEL\_ID ||**

&#x20;     **!message.author.bot ||**

&#x20;     **(client.user \&\& message.author.id === client.user.id)**

&#x20;   **) {**

&#x20;     **return;**

&#x20;   **}**



&#x20;   **void forwardRadarDetection(message);**



&#x20;   **const searchableText = \[**

&#x20;     **message.content || '',**

&#x20;     **...message.embeds.flatMap(embed => \[**

&#x20;       **embed.title || '',**

&#x20;       **embed.description || '',**

&#x20;       **...(embed.fields || \[]).flatMap(field => \[**

&#x20;         **field.name || '',**

&#x20;         **field.value || ''**

&#x20;       **])**

&#x20;     **])**

&#x20;   **].join('\\n');**

&#x20;   **const detectedRoleIds = new Set();**

&#x20;   **for (const role of message.mentions.roles.values()) {**

&#x20;     **if (SENZ\_PING\_ROLE\_IDS.has(role.id)) {**

&#x20;       **detectedRoleIds.add(role.id);**

&#x20;     **}**

&#x20;   **}**

&#x20;   **for (const roleId of SENZ\_PING\_ROLE\_IDS) {**

&#x20;     **if (**

&#x20;       **searchableText.includes(`<@\&${roleId}>`) ||**

&#x20;       **searchableText.includes(roleId)**

&#x20;     **) {**

&#x20;       **detectedRoleIds.add(roleId);**

&#x20;     **}**

&#x20;   **}**

&#x20;   **if (detectedRoleIds.size === 0) return;**

&#x20;   **await message.channel.send({**

&#x20;     **content: \[...detectedRoleIds].map(roleId => `<@\&${roleId}>`).join(' '),**

&#x20;     **allowedMentions: {**

&#x20;       **parse: \[],**

&#x20;       **roles: \[...detectedRoleIds],**

&#x20;       **users: \[],**

&#x20;       **repliedUser: false**

&#x20;     **}**

&#x20;   **});**

&#x20;   **console.log(**

&#x20;     **`🔔 Pings de SenZ V2 replicados: ${\[...detectedRoleIds].join(', ')}`**

&#x20;   **);**

&#x20; **} catch (error) {**

&#x20;   **console.error('❌ Error replicando pings de SenZ V2:', error);**

&#x20; **}**

**});**



**// BOT GUARDIAN: detección de @here no autorizado**

**client.on(Events.MessageCreate, async message => {**

&#x20; **try {**

&#x20;   **if (!message.guild || message.author.bot || !message.mentions.everyone || !/@here\\b/i.test(message.content)) return;**

&#x20;   **if (!GUARDIAN\_GUILD\_ID || message.guild.id !== GUARDIAN\_GUILD\_ID) return;**

&#x20;   **const member = message.member || await message.guild.members.fetch(message.author.id).catch(() => null);**

&#x20;   **if (memberHasOneOf(member, GUARDIAN\_HERE\_EXEMPT\_ROLE\_IDS)) return;**

&#x20;   **const result = await guardianAddWarning(message.guild, message.author, 'Uso de @here', 'automatico');**

&#x20;   **const dmSent = await guardianSendDm(message.author, 'Si sigues usando el @here te ira mal.');**

&#x20;   **if (!dmSent) console.warn(`BOT GUARDIAN: no se pudo enviar DM a ${message.author.tag}; los mensajes privados pueden estar cerrados.`);**

&#x20;   **console.log(`BOT GUARDIAN: @here no autorizado de ${message.author.tag}; warns=${result.total}.`);**

&#x20; **} catch (error) {**

&#x20;   **console.error('BOT GUARDIAN: error detectando @here:', error);**

&#x20; **}**

**});**

**// MENSAJES: ANTI-@EVERYONE, PERSONALIDAD Y COMANDOS DE OWNER**

**client.on(Events.MessageCreate, async message => {**

&#x20; **if (message.author.bot || !message.guild) {**

&#x20;   **return;**

&#x20; **}**

**// ANTI-@EVERYONE**

&#x20; **if (message.content.toLowerCase().includes('@everyone')) {**

&#x20;   **const hasExemptRole = message.member?.roles?.cache?.some(role =>**

&#x20;     **EVERYONE\_EXEMPT\_ROLE\_IDS.has(role.id)**

&#x20;   **) || false;**

&#x20;   **if (!hasExemptRole) {**

&#x20;     **const recordKey = `${message.guild.id}:${message.author.id}`;**

&#x20;     **const previousRecord = state.antiEveryone\[recordKey] || {**

&#x20;       **total: 0,**

&#x20;       **updatedAt: null**

&#x20;     **};**

&#x20;     **const total = Number(previousRecord.total || 0) + 1;**

&#x20;     **const now = Date.now();**

&#x20;     **const weeklyThreshold = 27;**

&#x20;     **const weeklyMode = Number(previousRecord.total || 0) >= weeklyThreshold;**

&#x20;     **const isSanction = total % 3 === 0 || weeklyMode;**

&#x20;     **state.antiEveryone\[recordKey] = {**

&#x20;       **total,**

&#x20;       **updatedAt: new Date(now).toISOString(),**

&#x20;       **lastGuildId: message.guild.id,**

&#x20;       **lastChannelId: message.channel.id**

&#x20;     **};**

**// Guardar el contador inmediatamente.**

&#x20;     **try {**

&#x20;       **saveState();**

&#x20;     **} catch (error) {**

&#x20;       **console.error('❌ Anti-@everyone: no se pudo guardar el historial:', error);**

&#x20;     **}**

&#x20;     **try {**

&#x20;       **await message.delete();**

&#x20;     **} catch (error) {**

&#x20;       **console.error('❌ Anti-@everyone: no se pudo borrar el mensaje:', error.message);**

&#x20;     **}**

&#x20;     **if (isSanction) {**

&#x20;       **const sanctionSteps = \[**

&#x20;         **{ at: 3, duration: 5 \* 60 \* 1000, label: '5 minutos' },**

&#x20;         **{ at: 6, duration: 10 \* 60 \* 1000, label: '10 minutos' },**

&#x20;         **{ at: 9, duration: 30 \* 60 \* 1000, label: '30 minutos' },**

&#x20;         **{ at: 12, duration: 60 \* 60 \* 1000, label: '1 hora' },**

&#x20;         **{ at: 15, duration: 6 \* 60 \* 60 \* 1000, label: '6 horas' },**

&#x20;         **{ at: 18, duration: 12 \* 60 \* 60 \* 1000, label: '12 horas' },**

&#x20;         **{ at: 21, duration: 24 \* 60 \* 60 \* 1000, label: '1 día' },**

&#x20;         **{ at: 24, duration: 3 \* 24 \* 60 \* 60 \* 1000, label: '3 días' },**

&#x20;         **{ at: 27, duration: 7 \* 24 \* 60 \* 60 \* 1000, label: '1 semana' }**

&#x20;       **];**

&#x20;       **const step = weeklyMode**

&#x20;         **? { duration: 7 \* 24 \* 60 \* 60 \* 1000, label: '1 semana' }**

&#x20;         **: \[...sanctionSteps].reverse().find(item => total >= item.at);**

&#x20;       **const member = message.member || await message.guild.members**

&#x20;         **.fetch(message.author.id)**

&#x20;         **.catch(() => null);**

&#x20;       **let timeoutApplied = false;**

&#x20;       **if (member \&\& member.moderatable) {**

&#x20;         **try {**

&#x20;           **await member.timeout(**

&#x20;             **step.duration,**

&#x20;             **`Uso no autorizado de @everyone (${total} detecciones)`**

&#x20;           **);**

&#x20;           **timeoutApplied = true;**

&#x20;         **} catch (error) {**

&#x20;           **console.error('❌ Anti-@everyone: no se pudo aplicar timeout:', error.message);**

&#x20;         **}**

&#x20;       **} else {**

&#x20;         **console.error(`❌ Anti-@everyone: no puedo aislar a ${message.author.tag}.`);**

&#x20;       **}**

&#x20;       **const dmText = timeoutApplied**

&#x20;         **? `🚫 Usaste @everyone demasiadas veces.**

**\*\*Uso número:\*\* ${total}**

**\*\*Sanción:\*\* aislamiento de \*\*${step.label}\*\*.**

**El mensaje fue eliminado. Después de alcanzar una semana, cada nuevo uso de @everyone conlleva otra semana de aislamiento.`**

&#x20;         **: `🚫 Usaste @everyone demasiadas veces.**

**\*\*Uso número:\*\* ${total}**

**\*\*Sanción prevista:\*\* aislamiento de \*\*${step.label}\*\*, pero el bot no pudo aplicarlo por falta de permisos o jerarquía. Avisá a un administrador.**

**El mensaje fue eliminado si el bot tenía permiso.`;**

&#x20;       **await message.author.send(dmText).catch(error => {**

&#x20;         **console.warn(`⚠️ Anti-@everyone: no pude enviar DM a ${message.author.tag}:`, error.message);**

&#x20;       **});**

&#x20;       **console.log(**

&#x20;         **`🚫 Anti-@everyone: ${message.author.tag}, uso ${total}, sanción ${step.label}, aplicada=${timeoutApplied}`**

&#x20;       **);**

&#x20;     **} else {**

&#x20;       **const warning = ((total - 1) % 3) + 1;**

&#x20;       **const dmText = `⚠️ Usaste @everyone: \*\*${warning}/3 advertencias\*\*.**

**El mensaje fue eliminado. Si llegás a 3 usos, recibirás un aislamiento temporal. Las advertencias y sanciones quedan guardadas aunque el bot se reinicie.`;**

&#x20;       **await message.author.send(dmText).catch(error => {**

&#x20;         **console.warn(`⚠️ Anti-@everyone: no pude enviar DM a ${message.author.tag}:`, error.message);**

&#x20;       **});**

&#x20;       **console.log(**

&#x20;         **`⚠️ Anti-@everyone: ${message.author.tag}, advertencia ${warning}/3 (uso ${total}).`**

&#x20;       **);**

&#x20;     **}**

&#x20;     **return;**

&#x20;   **}**

&#x20; **}**

&#x20; **const content = message.content.trim();**

**// PERSONALIDAD DEL SAE PREDICTOR**

&#x20; **const asksOpinion = /\\bque\\s+opinas(?:\\s+de\\s+esto)?\\s\*\\\\??/i.test(**

&#x20;   **content.normalize('NFD').replace(/\[\\u0300-\\u036f]/g, '')**

&#x20; **);**

&#x20; **if (**

&#x20;   **client.user \&\&**

&#x20;   **message.mentions.users.has(client.user.id) \&\&**

&#x20;   **asksOpinion**

&#x20; **) {**

&#x20;   **if (hasOwnerRole(message.member)) {**

&#x20;     **const respuestas = \[**

&#x20;       **'Puro cuento 🥱',**

&#x20;       **'Que habla ese 😂'**

&#x20;     **];**

&#x20;     **const respuesta =**

&#x20;       **respuestas\[Math.floor(Math.random() \* respuestas.length)];**

&#x20;     **await message.reply({**

&#x20;       **content: respuesta,**

&#x20;       **allowedMentions: { repliedUser: false }**

&#x20;     **});**

&#x20;   **} else {**

&#x20;     **await message.reply({**

&#x20;       **content: 'No tienes suficiente aura para que te haga caso 💀🥀',**

&#x20;       **allowedMentions: { repliedUser: false }**

&#x20;     **});**

&#x20;   **}**

&#x20;   **return;**

&#x20; **}**

**// Desde aquí, los otros comandos solo son para Owners.**

&#x20; **if (!hasOwnerRole(message.member)) {**

&#x20;   **return;**

&#x20; **}**

**// BORRAR CANALES QUE TERMINEN EN "BASE"**

&#x20; **if (content.toLowerCase() === '!borrarbases') {**

&#x20;   **const targets = message.guild.channels.cache.filter(channel =>**

&#x20;     **channel.name.toLowerCase().endsWith('base')**

&#x20;   **);**

&#x20;   **if (targets.size === 0) {**

&#x20;     **await message.reply('✅ No hay canales que terminen en "base".');**

&#x20;     **return;**

&#x20;   **}**

&#x20;   **await message.reply(**

&#x20;     **`⚠️ Encontré ${targets.size} canal(es) para eliminar.`**

&#x20;   **);**

&#x20;   **let deleted = 0;**

&#x20;   **let failed = 0;**

&#x20;   **for (const channel of targets.values()) {**

&#x20;     **try {**

&#x20;       **await channel.delete(**

&#x20;         **'Comando !borrarbases ejecutado por un Owner autorizado'**

&#x20;       **);**

&#x20;       **deleted++;**

&#x20;     **} catch (error) {**

&#x20;       **failed++;**

&#x20;       **console.error(**

&#x20;         **`Error eliminando ${channel.name} (${channel.id}):`,**

&#x20;         **error**

&#x20;       **);**

&#x20;     **}**

&#x20;   **}**

&#x20;   **await message.channel.send(**

&#x20;     **`🧹 \*\*Limpieza terminada\*\*\\n` +**

&#x20;     **`✅ Eliminados: ${deleted}\\n` +**

&#x20;     **`❌ Fallidos: ${failed}`**

&#x20;   **).catch(() => {});**

&#x20;   **return;**

&#x20; **}**

**// GENERAR UNA NUEVA PREDICCIÓN AUTOMÁTICA**

&#x20; **if (content.toLowerCase() === '!nuevaprediccion') {**

&#x20;   **try {**

&#x20;     **await publishDailyPrediction(client, { force: true });**

&#x20;     **await message.reply({**

&#x20;       **content: 'Nueva predicción subida maestro. <:Colossus:1557197762645467166>',**

&#x20;       **allowedMentions: { parse: \[] }**

&#x20;     **});**

&#x20;   **} catch (error) {**

&#x20;     **console.error('Error en !nuevaprediccion:', error);**

&#x20;     **await message.reply(**

&#x20;       **'❌ No pude subir la predicción. Revisá la consola.'**

&#x20;     **);**

&#x20;   **}**

&#x20;   **return;**

&#x20; **}**

**// EDITAR UN DIVINE DE LA PREDICCIÓN AUTOMÁTICA**

&#x20; **const time = parseTime(content);**

&#x20; **if (!time) return;**

&#x20; **const chance = parseChance(content);**

&#x20; **const divine = findDivine(content);**

&#x20; **if (!divine) return;**

&#x20; **try {**

&#x20;   **const changed = await editCurrentPrediction(**

&#x20;     **client,**

&#x20;     **divine,**

&#x20;     **time,**

&#x20;     **chance**

&#x20;   **);**

&#x20;   **if (changed) {**

&#x20;     **await message.reply(**

&#x20;       **`✅ Predicción de \*\*${getDivineDisplay(divine)}\*\* actualizada.`**

&#x20;     **);**

&#x20;   **} else {**

&#x20;     **await message.reply(**

&#x20;       **'⚠️ No encontré ese Divine en la predicción actual o la fecha supera las 72 horas.'**

&#x20;     **);**

&#x20;   **}**

&#x20; **} catch (error) {**

&#x20;   **console.error('Error editando predicción:', error);**

&#x20;   **await message.reply('❌ No pude editar la predicción.');**

&#x20; **}**

**});**

**// PREDICCIÓN AUTOMÁTICA DIARIA**

**cron.schedule(**

&#x20; **`${PREDICTION\_MINUTE} ${PREDICTION\_HOUR} \* \* \*`,**

&#x20; **() => {**

&#x20;   **publishDailyPrediction(client).catch(error =>**

&#x20;     **console.error('Error en predicción diaria:', error)**

&#x20;   **);**

&#x20; **},**

&#x20; **{**

&#x20;   **timezone: TIMEZONE**

&#x20; **}**

**);**

**// UFO EVENT - CADA HORA :00 Y :30**

**cron.schedule(**

&#x20; **'0,30 \* \* \* \*',**

&#x20; **async () => {**

&#x20;   **console.log('Cron UFO EVENT disparado.');**



&#x20;   **const success = await publishUFOEvent(client);**



&#x20;   **if (!success) {**

&#x20;     **console.error('No se pudo publicar UFO EVENT.');**

&#x20;   **}**

&#x20; **},**

&#x20; **{**

&#x20;   **timezone: TIMEZONE**

&#x20; **}**

**);**

**// ERRORES**

**client.on('error', error => {**

&#x20; **console.error('Discord Client Error:', error);**

**});**

**process.on('unhandledRejection', error => {**

&#x20; **console.error('UNHANDLED REJECTION:', error);**

**});**

**process.on('uncaughtException', error => {**

&#x20; **console.error('UNCAUGHT EXCEPTION:', error);**

**});**

**// LOGIN**

**client.login(TOKEN);**

