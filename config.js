export default {
    owner: ['573246039414'],
    botNumber: '',
    sessionName: 'Sessions/Owner',
    version: '^2.0 - Latest',
    dev: "pro",
    links: {
        api: 'https://api.yuki-wabot.my.id',
        channel: "",
        github: "",
        gmail: ""
    },
    my: {
        ch: '',
        name: 'Bot',
    },
    mess: {
        socket: ' Este comando solo puede ser ejecutado por un Socket.',
        admin: ' Este comando solo puede ser ejecutado por los Administradores del Grupo.',
        botAdmin: ' Este comando solo puede ser ejecutado si el Socket es Administrador del Grupo.'
    },
    giphyApiKey: process.env.GIPHY_API_KEY || 'qnl7ssQChTdPjsKta2Ax2LMaGXz303tq',
    removeBgKey: process.env.REMOVEBG_KEY || '',

    APIs: {
        xteam: 'https://api.xteam.xyz',
        dzx: 'https://api.dhamzxploit.my.id',
        lol: 'https://api.lolhuman.xyz',
        violetics: 'https://violetics.pw',
        neoxr_legacy: 'https://api.neoxr.my.id',
        zenzapis: 'https://zenzapis.xyz',
        akuari: 'https://api.akuari.my.id',
        akuari2: 'https://apimu.my.id',
        nrtm: 'https://fg-nrtm.ddns.net',

        // APIs principales y de la web
        lolhuman: { url: 'https://api.lolhuman.xyz/api', key: 'GataDiosV3' },
        stellar: { url: 'https://api.stellarwa.xyz', key: 'GataDios' },
        skizo: { url: 'https://skizo.tech/api', key: 'GataDios' },
        alyachan: { url: 'https://api.alyachan.dev/api', key: null },
        exonity: { url: 'https://exonity.tech/api', key: 'GataDios' },
        ryzendesu: { url: 'https://api.ryzendesu.vip/api', key: null },
        neoxr: { url: 'https://api.neoxr.eu/api', key: 'GataDios' },
        davidcyriltech: { url: 'https://api.davidcyriltech.my.id', key: null },
        dorratz: { url: 'https://api.dorratz.com', key: null },
        siputzx: { url: 'https://api.siputzx.my.id/api', key: null },
        vreden: { url: 'https://api.vreden.web.id/api', key: null },
        fgmods: { url: 'https://api.fgmods.xyz/api', key: 'elrebelde21' },
        popcat: { url: 'https://api.popcat.xyz', key: null },
        llama: { url: 'https://ab-llama-ai.abrahamdw882.workers.dev', key: null },

        // Nuevas APIs de Inteligencia Artificial
        abztech_gemini: { url: 'https://api-abztech.zone.id/ai/gemini', key: null },
        abztech_perplexity: { url: 'https://api-abztech.zone.id/ai/perplexity', key: null },
        capilot: { url: 'https://capilotapi.vercel.app', key: null },
        rebix_deepseek_r1: { url: 'https://api-rebix.zone.id/api/deepseek-r1', key: null },
        rebix_deepseek_v3: { url: 'https://api-rebix.zone.id/api/deepseek-v3', key: null },
        rebix_gemini: { url: 'https://api-rebix.zone.id/api/gemini', key: null },

        // Secondary fallbacks — used by downloader.js
        ootaizumi: { url: "https://api.ootaizumi.web.id", key: null },
        delirius: { url: "https://api.delirius.online", key: null },
        nekolabs: { url: "https://api.nekolabs.web.id", key: null },
        axi: { url: "https://apiaxi.i11.eu", key: null },
        apifaa: { url: "https://api-faa.my.id", key: null },
        xyro: { url: "https://api.xyro.site", key: null },
        zenzxz: { url: "https://api.zenzxz.my.id", key: null },
    },

    APIKeys: {
        'https://api.xteam.xyz': 'd90a9e986e18778b',
        'https://api.lolhuman.xyz': 'GataDiosV3',
        'https://api.lolhuman.xyz/api': 'GataDiosV3',
        'https://api.neoxr.eu/api': 'GataDios',
        'https://skizo.tech/api': 'GataDios',
        'https://exonity.tech/api': 'GataDios',
        'https://api.stellarwa.xyz': 'GataDios',
        'https://api.fgmods.xyz/api': 'elrebelde21',
        'https://violetics.pw': 'beta',
        'https://zenzapis.xyz': process.env.ZENZAPIS_KEY || 'yourkey'
    }
};
