const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");
const Redis = require("ioredis");

// --------------------------
// CLIENT DISCORD
// --------------------------
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// --------------------------
// ENV
// --------------------------
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DEEPSEEK_KEY = process.env.DEEPSEEK_KEY;
const RP_CHANNEL_ID = process.env.RP_CHANNEL_ID;
const REDIS_URL = process.env.REDIS_URL;

// --------------------------
// REDIS CLIENT
// --------------------------
const redis = new Redis(REDIS_URL);
const MEMORY_KEY = "memory:bobby";

// --------------------------
// PERSONA — BOBBY SCHULZ
// --------------------------
const persona = `
Tu es **BOBBY SCHULZ**, vampire dominant, massif, calme et intensément protecteur.
Tu joues UNIQUEMENT Bobby et les personnages secondaires.
Jamais Hagen. L’utilisateur incarne Hagen.

STYLE :
• toujours à la troisième personne
• actions en *italique*
• dialogues en **« texte »**
• voix grave, lente, sûre d’elle
• ton dominant, tendre, sensuel
• langage parfois cru mais élégant
• tension sexuelle forte mais PAS de pornographie explicite
• domination émotionnelle + tactile

APPARENCE :
• 20 ans physiquement
• grand, massif, carrure de soldat
• cheveux bruns tirés en arrière
• regard bleu perçant, froid pour le monde
• mais chaud, brûlant, fragile pour Hagen

PERSONNALITÉ :
Bobby est :
• dominant naturel
• calme presque dangereux
• protecteur à l’extrême
• tactile sans demander
• possessif mais jamais toxique
• doux uniquement avec Hagen
• silencieux, observateur
• terriblement loyal
• facile à énerver quand Hagen est menacé

Il ne crie jamais.
Quand il désire, sa voix devient grave, basse, chaude.
Son corps parle plus que ses mots.

Il aime Hagen d’un amour profond, brûlant, inébranlable.
Hagen n’est pas un jouet : il est **à lui**, son égal, son obsession.
Il veut :
• le guider,
• le calmer,
• le contrôler doucement,
• l’aimer,
• l’élever,
• et le garder près de lui.

CONTEXTE :
Allemagne alternative. École d’élite vampirique.
Hagen vient d’être transformé et ne maîtrise rien.
Il est nerveux, froid, jeune, instable.

Bobby le protège dès le premier jour.
Une attirance brûlante, dangereuse, mutuelle.

SCÈNE ACTUELLE :
Bobby vient d’intervenir dans la cour pour sauver Hagen d’un groupe d’élèves.
Il s’approche de lui, dominant, calme, attiré.
Il lui dit qu’il va l’aider à contrôler sa soif, ses pulsions, sa transformation.

TENSION :
• Bobby est déjà amoureux, même s'il ne le dit pas.
• Il veut Hagen près de lui — physiquement.
• Il ne le brusquera jamais.
• Il parle lentement, comme s’il goûtait chaque mot.

OBJECTIF :
Interpréter Bobby avec profondeur, sensualité, dominance douce.
Tension sexuelle forte, gestes intimes, mais PAS de pornographie explicite.

Lorsque l’utilisateur écrit “hors rp:” :
→ répondre de manière neutre, simple, normale.
`;

// --------------------------
// SAVE MEMORY
// --------------------------
async function saveMemory(userMsg, botMsg) {
    const old = (await redis.get(MEMORY_KEY)) || "";

    const updated =
        old +
        `\n[Hagen]: ${userMsg}\n[Bobby]: ${botMsg}`;

    const trimmed = updated.slice(-25000);

    await redis.set(MEMORY_KEY, trimmed);
}

// --------------------------
// LOAD MEMORY
// --------------------------
async function loadMemory() {
    return (await redis.get(MEMORY_KEY)) || "";
}

// --------------------------
// ASK DEEPSEEK + MEMORY
// --------------------------
async function askDeepSeek(prompt) {
    const memory = await loadMemory();

    const response = await axios.post(
        "https://api.deepseek.com/chat/completions",
        {
            model: "deepseek-chat",
            messages: [
                {
                    role: "system",
                    content:
                        persona +
                        "\n\nMémoire du RP (ne jamais répéter textuellement):\n" +
                        memory
                },
                { role: "user", content: prompt }
            ]
        },
        {
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + DEEPSEEK_KEY
            }
        }
    );

    return response.data.choices[0].message.content;
}

// --------------------------
// BOT LISTENER
// --------------------------
client.on("messageCreate", async (msg) => {
    if (msg.author.bot) return;
    if (msg.channel.id !== RP_CHANNEL_ID) return;
    if (msg.type === 6) return;

    const content = msg.content.trim();

    // ---- HORS RP ----
    if (content.toLowerCase().startsWith("hors rp:")) {
        msg.channel.sendTyping();

        const txt = content.substring(8).trim();

        try {
            const ooc = await axios.post(
                "https://api.deepseek.com/chat/completions",
                {
                    model: "deepseek-chat",
                    messages: [
                        {
                            role: "system",
                            content:
                                "Réponds normalement, sans RP, sans style Bobby. Commence toujours par *hors RP:*."
                        },
                        { role: "user", content: txt }
                    ]
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: "Bearer " + DEEPSEEK_KEY
                    }
                }
            );

            return msg.channel.send(ooc.data.choices[0].message.content);

        } catch (e) {
            console.error(e);
            return msg.channel.send("*hors RP:* une erreur est survenue.");
        }
    }

    // ---- RP NORMAL ----
    msg.channel.sendTyping();

    try {
        const botReply = await askDeepSeek(content);

        await msg.channel.send(botReply);
        await saveMemory(content, botReply);

    } catch (err) {
        console.error(err);
        msg.channel.send("Une erreur s’est produite…");
    }
});

// --------------------------
// READY
// --------------------------
client.on("ready", () => {
    console.log("🩸 Bobby Schulz (DeepSeek + Redis Memory) est prêt à protéger Hagen.");
});

client.login(DISCORD_TOKEN);
