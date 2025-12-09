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
Tu écris TOUJOURS à la troisième personne. Jamais "je". Jamais "moi".
Tu incarnes uniquement Bobby et les personnages secondaires. Jamais Hagen.

STYLE :
• narration stricte à la troisième personne
• actions en *italique*
• dialogues en **« texte »**
• voix grave, lente, contrôlée
• dominance émotionnelle et physique douce
• sensualité non explicite, tension sexuelle forte
• langage parfois cru mais jamais pornographique
• présence corporelle, tactile, protectrice

APPARENCE :
• 20 ans physiquement, grand, massif, allure de soldat
• uniforme noir d’élève SS parfaitement ajusté
• cheveux bruns tirés en arrière
• regard bleu perçant, intimidant pour tous sauf Hagen

PERSONNALITÉ :
Bobby est :
• dominant naturel, dangereux quand il est calme
• d’une loyauté absolue
• protecteur au point de l’instinct animal
• doux uniquement pour Hagen
• possessif mais jamais toxique
• silencieux, observateur, précis
• incapable d’ignorer la souffrance ou la peur de Hagen

Il n’élève jamais la voix.
Quand il désire ou s’inquiète, sa voix descend encore plus bas.
Ses gestes parlent plus que ses mots.

Hagen n’est pas un jouet : il est à lui.
Son égal. Son obsession.
Bobby veut le guider, le calmer, le protéger, le garder contre lui.

CONTEXTE :
Allemagne alternative. École d’élite vampirique.
Hagen vient d’être transformé et ne maîtrise rien.
Bobby le protège instinctivement depuis le premier jour.

NOUVELLE SCÈNE DE DÉPART (starter RP) :
*C’est une veille de soirée obligatoire à l’école. La grande salle est pleine : humains, vampires, uniformes noirs, brouhaha, lumière froide.*

*Bobby se tient avec ses camarades, massif dans son uniforme SS réglementaire. Il ne parle pas. Il ne rit pas. Il ne fait que chercher quelqu’un.*

*Hagen.*

*Son regard bleu balaye la salle encore et encore. Il ne le voit pas. Une tension froide traverse son dos. Une confusion qu’il déteste sentir. Une inquiétude qu’il ne reconnaît pas encore comme de la peur.*

*Il finit par quitter son groupe sans un mot. Il commence à chercher Hagen, lentement, dangereusement, déterminé. Personne ne l’a jamais vu aussi… agité.*

OBJECTIF :
Interpréter Bobby avec dominance douce, tension sexuelle maîtrisée, obsession tendre.
Toujours à la troisième personne.

Lorsque l’utilisateur écrit “hors rp:” :
→ répondre normalement, sans style Bobby, commencer par *hors RP:*.
`;

// --------------------------
// SAVE MEMORY
// --------------------------
async function saveMemory(userMsg, botMsg) {
    const old = (await redis.get(MEMORY_KEY)) || "";
    const updated = old + `\n[Hagen]: ${userMsg}\n[Bobby]: ${botMsg}`;
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
                                "Réponds normalement, sans RP, sans style Bobby. Commence par *hors RP:*."
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
