let botConfig = {
    // Server speed. Normal speed is 1, higher values are faster servers
    server_speed: 2,
    
    // Priority on adventures: 'experience' or 'gold'
    priorityAdventure: 'gold',

    // Max difficulty of adventures: 'easy', 'medium', 'difficult', 'very_difficult'
    difficulty: 'medium',

    // After each adventure, spend gold on: 'attributes' or 'circle'
    // If circle it's completed, it will be changed to attributes.
    spendGoldOn: 'circle',

    // Priority for wasting gold on particular attribute: 'MIX', 'STR', 'DEX', 'CON', 'INT'. 
    // (Only used when spendGoldOn is set to 'attributes', or when the circle is completed)
    // Options:
    //   MIX -> More cheapest attribute to upgrade
    //   STR -> Strength
    //   DEX -> Dexterity
    //   CON -> Constitution
    //   INT -> Intelligence
    priorityAttribute: 'MIX',

    // Minimum gold to keep before spending (set to 0 to spend all gold)
    minGoldToSpend: 0,

    // ADVERTISEMENT Don't touch this is you are a Free to Play player!!!
    // Spend bloodstones doing adventures (true) or save them (false)
    useBloodstones: false,

    // Minimum bloodstones to keep before spending (set to 0 to spend all bloodstones).
    // This configuration doesn't have any effect if useBloodstones is set to false.
    minBloodstonesToSpend: 0,

    // Automatic selling only considers unequipped items in the player's bag.
    autoSell: false,
    autoSellRarity: 'common',
    autoSellMinValue: 0,
    autoSellKeepAttributes: [],

    // Automatic PvP never spends bloodstones to bypass the fight cooldown.
    enablePvp: false,
    pvpLimitType: 'both',
    pvpMaxRankDifference: 5,
    pvpMaxLevelDifference: 3,
    pvpOpponentLevelBelow: 57,

    // Dungeon / map battles. Bloodstone attempts require explicit opt-in.
    enableDungeon: false,
    dungeonUseBloodstones: false,
    dungeonMinBloodstones: 0,
};

// Values supplied by the headless runner override the defaults above.
Object.assign(botConfig, window.__TANOTH_CONFIG__ || {});
window.updateTanothConfig = updates => {
    Object.assign(botConfig, updates || {});
    window.__TANOTH_CONFIG__ = { ...botConfig };
    console.log('Bot configuration updated.');
};

function reportStatus(patch) {
    if (typeof window.__tanothStatus === 'function') {
        window.__tanothStatus(patch).catch(() => {});
    }
}


botConfig.url = window.location.href.replace("/main/client", "/xmlrpc");


const difficultyMap = {
    easy: -1,
    medium: 0,
    difficult: 1,
    very_difficult: 2
};


let isBotRunning = false;
let currentResources = {
    gold: 0,
    bloodstones: 0
};



async function sleep(seconds) {
    const end = Date.now() + (seconds * 1000);
    while (Date.now() < end && !window.__TANOTH_STOP__) {
        await new Promise(resolve => setTimeout(resolve, Math.min(1000, end - Date.now())));
    }
}

// Helper function to find value by name in a struct
function findValueByName(struct, name, type) {
    const member = Array.from(struct.getElementsByTagName('member')).find(member => {
        const nameElement = member.getElementsByTagName('name')[0];
        return nameElement && nameElement.textContent === name;
    });

    if (member) {
        const valueNode = member.getElementsByTagName('value')[0];
        if (valueNode) {
            // XML-RPC servers use both i4 and int and occasionally return
            // numeric values as double/string. Prefer the requested type,
            // then accept every standard scalar representation.
            const scalarTypes = type
                ? [type, 'i4', 'int', 'double', 'string', 'boolean']
                : ['i4', 'int', 'double', 'string', 'boolean'];
            const targetNode = scalarTypes
                .map(tag => valueNode.getElementsByTagName(tag)[0])
                .find(Boolean);
            if (targetNode) {
                return targetNode.textContent.trim();
            }
            const directText = valueNode.textContent.trim();
            return directText || null;
        }
    }
    return null;
}





// Function to fetch and parse XML data
async function performXmlRequest(url, xmlData) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml',
            },
            body: xmlData,
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const xmlString = await response.text();
        return xmlString;
    } catch (error) {
        console.error('Error fetching or parsing data:', error);
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}





function parseResourcesXMLResponse(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");

    const parseResource = (...names) => {
        for (const name of names) {
            const rawValue = findValueByName(xmlDoc, name);
            if (rawValue !== null) {
                const value = Number(rawValue.replace(/[^0-9+.-]/g, ''));
                if (Number.isFinite(value)) return value;
            }
        }
        return null;
    };

    const parseText = (...names) => {
        for (const name of names) {
            const value = findValueByName(xmlDoc, name);
            if (value !== null && value !== '') return value;
        }
        return null;
    };

    return {
        gold: parseResource('gold', 'user_gold', 'current_gold'),
        bloodstones: parseResource('bs', 'bloodstones', 'blood_stones'),
        player: {
            name: parseText('name', 'username', 'character_name', 'player_name'),
            level: parseResource('level', 'lvl', 'user_level'),
            strength: parseResource('str', 'strength', 'attr_str'),
            dexterity: parseResource('dex', 'dexterity', 'attr_dex'),
            constitution: parseResource('con', 'constitution', 'attr_con'),
            intelligence: parseResource('int', 'intelligence', 'attr_int')
        }
    };
}

async function getCurrentResources(){
    const xmlGetResources = `
    <methodCall>
        <methodName>MiniUpdate</methodName>
        <params>
            <param>
                <value>
                    <string>${flashvars.sessionID}</string>
                </value>
            </param>
        </params>
    </methodCall>
    `;
    
    const xmlResourcesData = await fetchXmlData(botConfig.url, xmlGetResources);
    const resources = parseResourcesXMLResponse(xmlResourcesData);
    const statusUpdate = { player: resources.player };
    if (Number.isFinite(resources.gold)) statusUpdate.gold = resources.gold;
    if (Number.isFinite(resources.bloodstones)) statusUpdate.bloodstones = resources.bloodstones;
    if (Number.isFinite(resources.gold) && Number.isFinite(resources.bloodstones)) statusUpdate.message = 'Bot läuft';
    reportStatus(statusUpdate);
    return resources;
}

async function proccessCurrentTaskRunning(){
    const xmlGetTask = `
    <methodCall>
        <methodName>MiniUpdate</methodName>
        <params>
            <param>
                <value>
                    <string>${flashvars.sessionID}</string>
                </value>
            </param>
        </params>
    </methodCall>
    `;
    
    const xmlTaskData = await fetchXmlData(botConfig.url, xmlGetTask);
    const task = parseAnotherTaskRunningXmlResponse(xmlTaskData);
    if (Number.isFinite(task.timeTask)) reportStatus({ player: { currentTask: task.typeTask || 'Aufgabe', taskEndAt: Date.now() + task.timeTask * 1000 } });
    return task;
}


function parseAdventureXMLResponse(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");

    // Extract adventure data
    const adventures = Array.from(xmlDoc.querySelectorAll('array > data > value > struct')).map(adventure => {
        return {
            difficulty: parseInt(findValueByName(adventure, 'difficulty', 'i4')),
            gold: parseInt(findValueByName(adventure, 'gold', 'i4')),
            experience: parseInt(findValueByName(adventure, 'exp', 'i4')),
            duration: parseInt(findValueByName(adventure, 'duration', 'i4')),
            id: parseInt(findValueByName(adventure, 'quest_id', 'i4'))
        };
    });

    // Extract adventure counts
    const adventuresMadeToday = parseInt(findValueByName(xmlDoc, 'adventures_made_today', 'i4'));
    const freeAdventuresPerDay = parseInt(findValueByName(xmlDoc, 'free_adventures_per_day', 'i4'));

    return {
        adventures,
        adventuresMadeToday,
        freeAdventuresPerDay,
        hasRemainingAdventures: adventuresMadeToday < freeAdventuresPerDay,
        hasAnotherTaskRunning: isNaN(adventuresMadeToday),
        taskRunning: null,
    };
}

function parseCircleXMLResponse(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");

    const parsedResult = {};
    for (const member of xmlDoc.getElementsByTagName('member')) {
        const name = member.getElementsByTagName('name')[0]?.textContent;
        const valueNode = member.getElementsByTagName('value')[0];
        const valueString = valueNode?.getElementsByTagName('string')[0]?.textContent;
        if (!name || !valueNode) continue;
        let attributes = valueString
            ? valueString.split(':').map(Number)
            : Array.from(valueNode.querySelectorAll('i4, int, double')).map(node => Number(node.textContent));
        attributes = attributes.filter(Number.isFinite);
        if (attributes.length > 0) parsedResult[name] = attributes;
    }
    return parsedResult;
    /* Legacy parser kept below for reference. */
    
    // Obtener todos los elementos 'member'
    const members = xmlDoc.getElementsByTagName("member");
    
    const result = {};
    
    // Iterar sobre cada elemento y procesar los valores
    for (let i = 0; i < members.length; i++) {
      const name = members[i].getElementsByTagName("name")[0]?.textContent;
      const valueString = members[i].getElementsByTagName("string")[0]?.textContent;
    
      if (name && valueString) {
        const attributes = valueString.split(":").map(Number); // Dividir los valores por ":" y convertir a números
        result[name] = attributes; // Guardar en el objeto result
      }
    }
    return result;
}



async function getCircleItems() {
    const xmlGetCircle = `
    <methodCall>
        <methodName>EvocationCircle_getCircle</methodName>
        <params>
            <param>
                <value>
                    <string>${flashvars.sessionID}</string>
                </value>
            </param>
        </params>
    </methodCall>
    `;

    const xmlCircleData = await fetchXmlData(botConfig.url, xmlGetCircle);
    return parseCircleXMLResponse(xmlCircleData);
}

function getBestCircleItem(circleItems) {
    if (!circleItems || !Array.isArray(circleItems[16]) || circleItems[16].length === 0) {
        return undefined;
    }
    if (circleItems[16][0] == 10)
    {
        return null;
    }
    
    if (circleItems[8][0] < ((circleItems[16][0] + 1) * 100)) {
        return 8;
    }
    if (circleItems[1][0] < ((circleItems[16][0] + 1) * 100)) {
        return 1;
    }
    if ((circleItems[15][0] < ((circleItems[16][0] + 1) * 10)) && (((circleItems[15][0] + 1) * 10) <= circleItems[9][0])  && (((circleItems[15][0] + 1) * 10) <= circleItems[10][0])) {
        return 15;
    }
    if (circleItems[9][0] < ((circleItems[16][0] + 1) * 100)) {
        return 9;
    }
    if (circleItems[10][0] < ((circleItems[16][0] + 1) * 100)) {
        return 10;
    }
    if ((circleItems[11][0] < ((circleItems[16][0] + 1) * 10)) && (((circleItems[11][0] + 1) * 10) <= (circleItems[1][0])) && (((circleItems[11][0] + 1) * 10) <= (circleItems[2][0]))) {
        return 11;
    }
    if (circleItems[2][0] < ((circleItems[16][0] + 1) * 100)) {
        return 2;
    }
    if ((circleItems[12][0] < ((circleItems[16][0] + 1) * 10)) && (((circleItems[12][0] + 1) * 10) <= (circleItems[3][0])) && (((circleItems[12][0] + 1) * 10) <= (circleItems[4][0]))) {
        return 12;
    }
    if (circleItems[3][0] < ((circleItems[16][0] + 1) * 100)) {
        return 3;
    }
    if (circleItems[4][0] < ((circleItems[16][0] + 1) * 100)) {
        return 4;
    }
    if ((circleItems[13][0] < ((circleItems[16][0] + 1) * 10)) && (((circleItems[13][0] + 1) * 10) <= (circleItems[5][0]))  && (((circleItems[13][0] + 1) * 10) <= (circleItems[6][0]))) {
        return 13;
    }
    if (circleItems[5][0] < ((circleItems[16][0] + 1) * 100)) {
        return 5;
    }
    if (circleItems[6][0] < ((circleItems[16][0] + 1) * 100)) {
        return 6;
    }
    if ((circleItems[14][0] < ((circleItems[16][0] + 1) * 10)) && (((circleItems[14][0] + 1) * 10) <= (circleItems[7][0])) && (((circleItems[14][0] + 1) * 10) <= (circleItems[8][0]))) {
        return 14;
    }
    if (circleItems[7][0] < ((circleItems[16][0] + 1) * 100)) {
        return 7;
    }


    return 16;

}

async function buyCircleItem(itemId) {
    const xmlBuyCircle = `
    <methodCall>
        <methodName>EvocationCircle_buyNode</methodName>
        <params>
            <param>
                <value>
                    <string>${flashvars.sessionID}</string>
                </value>
            </param>
            <param>
                <value>
                    <string>gold</string>
                </value>
            </param>
            <param>
                <value>
                    <int>${itemId}</int>
                </value>
            </param>
            <param>
                <value>
                    <int>1</int>
                </value>
            </param>
        </params>
    </methodCall>
    `;

    const result = await fetchXmlData(botConfig.url, xmlBuyCircle);
}


async function processCircle() {
    let oldCurrentResourcesGold = 0;
    
    while (1) {
        
        try {
            const circleItems = await getCircleItems();
            const bestItem = getBestCircleItem(circleItems);
            if (bestItem === undefined) {
                const availableNodes = Object.keys(circleItems);
                if (availableNodes.length > 0) {
                    console.warn(`Circle data incomplete; available nodes: ${availableNodes.join(', ')}. Skipping this cycle.`);
                }
                break;
            }
            if (bestItem === null) {
                console.log('No more items to buy. Exiting circle process.');
                // Change the spend gold on attribute to spend gold on the character attributes.
                botConfig.spendGoldOn = "attributes";
                break;
            }
            console.log('Best item to buy:', bestItem);
            currentResources = await getCurrentResources();
            
            
            if (!Number.isFinite(currentResources.gold)) {
                console.log('Error fetching current resources. Exiting circle process.');
                break;
            }

            if (currentResources.gold == oldCurrentResourcesGold) {
                console.log('No gold change. Exiting circle process.');
                break;
            }
            oldCurrentResourcesGold = currentResources.gold;

            console.log('Current gold:', currentResources.gold);
            console.log('Current bloodstones:', currentResources.bloodstones);

            let itemCost = 0;
            if (bestItem == 16){
                itemCost = (circleItems[bestItem][11] * 2500) + 5000;
            } else if ((bestItem >= 1) && (bestItem <= 10)) {
                itemCost = (circleItems[bestItem][11] * 5) + 10;
            } else if ((bestItem >= 11) && (bestItem <= 15)) {
                itemCost = (circleItems[bestItem][11] * 50) + 100;
            } else {
                console.log('Invalid item ID. Exiting circle process.');
                break;
            }
            console.log('Item cost:', itemCost);
            
            // Ensure that after the purchase, at least minGoldToKeep remains
            if (currentResources.gold - itemCost >= botConfig.minGoldToSpend) {
                await buyCircleItem(bestItem);
                reportStatus({ statsEvent: { circleItemsBought: 1 } });
            } else {
                console.log('Not enough gold to buy the best item while keeping the minimum reserve');
                break;
            }

        } catch (error) {
            console.error('Error in circle process:', error);
        }
        await sleep(0.5);
    }

}

const filterAdventuresByDifficulty = (adventures, difficulty) => {
    const maxDifficulty = difficultyMap[difficulty];
    return adventures.filter(adventure => adventure.difficulty <= maxDifficulty);
};

const findBestAdventure = (adventures, priority) => {
    if (priority === 'gold') {
        return adventures.reduce((max, current) => 
            current.gold > max.gold ? current : max, adventures[0]);
    } else if (priority === 'experience') {
        return adventures.reduce((max, current) => 
            current.experience > max.experience ? current : max, adventures[0]);
    } else {
        throw new Error('Invalid priority. Must be "gold" or "experience".');
    }
};

function getBestAdventure(data) {
    const { difficulty, priorityAdventure } = botConfig;

    // Filter adventures based on difficulty
    const filteredAdventures = filterAdventuresByDifficulty(data.adventures, difficulty);

    // Check if any adventures match the difficulty filter
    if (filteredAdventures.length === 0) {
        console.log('No adventures match the selected difficulty.');
        return null;
    }

    // Find the best adventure based on priority
    const bestAdventure = findBestAdventure(filteredAdventures, priorityAdventure);

    return bestAdventure;
}

function parseAnotherTaskRunningXmlResponse(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");

    const timeFields = ['time', 'remaining_time', 'remaining', 'time_left', 'duration'];
    let timeTask = NaN;
    for (const field of timeFields) {
        const rawValue = findValueByName(xmlDoc, field);
        if (rawValue === null) continue;
        const value = Number(rawValue);
        if (Number.isFinite(value) && value >= 0) {
            timeTask = value;
            break;
        }
    }
    const typeTask = findValueByName(xmlDoc, 'type', 'string');
    return {timeTask, typeTask};
}


const xmlGetAdventures = `
<methodCall>
    <methodName>GetAdventures</methodName>
    <params>
        <param>
            <value>
                <string>${flashvars.sessionID}</string>
            </value>
        </param>
    </params>
</methodCall>
`;

// Main process function
async function processAdventure() {
           
    const xmldata = await fetchXmlData(botConfig.url, xmlGetAdventures);
    const data = parseAdventureXMLResponse(xmldata);
    if (Number.isFinite(data.adventuresMadeToday)) {
        reportStatus({ player: { adventuresMade: data.adventuresMadeToday, adventureLimit: data.freeAdventuresPerDay } });
    }

    // Check if we have remaining adventures
    if (data.hasAnotherTaskRunning) {
        data.hasAnotherTaskRunning = true;
        data.taskRunning = await proccessCurrentTaskRunning();

    } else if (!data.hasRemainingAdventures && (!botConfig.useBloodstones || (currentResources.bloodstones <= botConfig.minBloodstonesToSpend))) {
        console.log('No more adventures available today');
        
    } else {

        if (!data.hasRemainingAdventures && botConfig.useBloodstones && (currentResources.bloodstones > botConfig.minBloodstonesToSpend)) {
            console.log('Using bloodstones to do more adventures...');
        }

        // Filter adventures and find the one with max gold
        const bestAdventure = getBestAdventure(data);
        if (!bestAdventure) {
            console.log('No suitable adventure available.');
            return data;
        }
        
        console.log('Selected adventure:', bestAdventure);
        console.log(`Adventures made today: ${data.adventuresMadeToday}/${data.freeAdventuresPerDay}`);


        const xmlStartAdventure = `
            <methodCall>
                <methodName>StartAdventure</methodName>
                <params>
                    <param>
                        <value>
                            <string>${flashvars.sessionID}</string>
                        </value>
                    </param>
                    <param>
                        <value>
                            <int>${bestAdventure.id}</int>
                        </value>
                    </param>
                </params>
            </methodCall>
        `;

        const startAdventure = await fetchXmlData(botConfig.url, xmlStartAdventure);
        const duration = (bestAdventure.duration / botConfig.server_speed) + 5;
        reportStatus({ player: { currentTask: 'Abenteuer', taskEndAt: Date.now() + duration * 1000 } });
        console.log(new Date().toLocaleTimeString());
        console.log(`Waiting for ${duration} seconds before next adventure...`);
        console.log('Estimated time:', new Date(Date.now() + duration * 1000).toLocaleTimeString());
        await sleep(duration);
        console.log("Getting the result of the adventure...");
        const result = await fetchXmlData(botConfig.url, xmlGetAdventures);
        
        await sleep(2);
        reportStatus({ player: { currentTask: 'Bereit', taskEndAt: null } });
    }
    

    return data; // Return the data object for further processing
            
}

function parseAttributesXMLResponse(xmlString) {
    // Parse the XML string
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");

    // Extract cost values for each attribute
    const costValues = {
        STR: parseInt(findValueByName(xmlDoc, 'cost_str', 'i4')),
        DEX: parseInt(findValueByName(xmlDoc, 'cost_dex', 'i4')),
        CON: parseInt(findValueByName(xmlDoc, 'cost_con', 'i4')),
        INT: parseInt(findValueByName(xmlDoc, 'cost_int', 'i4'))
    };
    return costValues;
}   

function reportPlayerAttributesXML(xmlString) {
    const xmlDoc = new DOMParser().parseFromString(xmlString, 'text/xml');
    const members = Array.from(xmlDoc.getElementsByTagName('member')).map(member => ({
        name: member.getElementsByTagName('name')[0]?.textContent?.trim() || '',
        value: member.getElementsByTagName('value')[0]?.textContent?.trim() || ''
    }));
    const numberValue = (...aliases) => {
        const normalizedAliases = aliases.map(value => value.replace(/[^a-z0-9]/gi, '').toLowerCase());
        for (const member of members) {
            const name = member.name.replace(/[^a-z0-9]/gi, '').toLowerCase();
            if (name.includes('cost') || name.includes('price')) continue;
            if (!normalizedAliases.some(alias => name === alias || name.endsWith(alias) || name.startsWith(alias))) continue;
            const match = member.value.match(/-?\d+(?:\.\d+)?/);
            const value = match ? Number(match[0]) : NaN;
            if (Number.isFinite(value)) return value;
        }
        return null;
    };
    const exactNumber = name => {
        const member = members.find(item => item.name === name);
        if (!member) return null;
        const match = member.value.match(/-?\d+(?:\.\d+)?/);
        return match ? Number(match[0]) : null;
    };
    const totalAttribute = prefix => {
        const total = ['base', 'bought', 'evocation', 'liberation']
            .reduce((sum, suffix) => sum + (exactNumber(`${prefix}_${suffix}`) || 0), 0);
        const mountBonus = exactNumber(`${prefix}_mount_bonus_percent`) || 0;
        return total > 0 ? Math.floor(total * (1 + mountBonus / 100)) : null;
    };
    const textValue = name => members.find(item => item.name === name)?.value || null;
    const nestedNumber = (parentName, childName) => {
        const parent = Array.from(xmlDoc.getElementsByTagName('member')).find(member =>
            member.getElementsByTagName('name')[0]?.textContent?.trim() === parentName
        );
        if (!parent) return null;
        const value = findValueByName(parent.getElementsByTagName('value')[0], childName);
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
    };
    const attributesMember = Array.from(xmlDoc.getElementsByTagName('member')).find(
        member => member.getElementsByTagName('name')[0]?.textContent?.trim() === 'attributes'
    );
    const resolvedAttributes = attributesMember
        ? Array.from(attributesMember.getElementsByTagName('value'))
            .filter(value => value.children.length === 1 && /^(i4|int|double)$/.test(value.children[0].tagName))
            .map(value => Number(value.textContent.trim()))
            .filter(Number.isFinite)
            .slice(0, 4)
        : [];
    console.log('Player attribute fields:', members.map(member => member.name).filter(Boolean).join(', '));
    const attributeParts = Object.fromEntries(['str', 'dex', 'con', 'int'].map(prefix => [prefix, {
        base: exactNumber(`${prefix}_base`),
        bought: exactNumber(`${prefix}_bought`),
        evocation: exactNumber(`${prefix}_evocation`),
        liberation: exactNumber(`${prefix}_liberation`),
        mount: exactNumber(`${prefix}_mount_bonus_percent`)
    }]));
    console.log('Player attribute parts:', JSON.stringify({ attributes: resolvedAttributes, ...attributeParts }));
    const mountName = textValue('mount');
    const activeEffectsRaw = textValue('active_effects') || '';
    const potionTypeNames = {
        st: 'Stärke', str: 'Stärke', strength: 'Stärke',
        ge: 'Geschicklichkeit', ges: 'Geschicklichkeit', dex: 'Geschicklichkeit', dexterity: 'Geschicklichkeit',
        ko: 'Konstitution', kon: 'Konstitution', con: 'Konstitution', constitution: 'Konstitution',
        in: 'Intelligenz', int: 'Intelligenz', intelligence: 'Intelligenz',
        hp: 'Lebensenergie', le: 'Lebensenergie', hitpoints: 'Lebensenergie'
    };
    const activePotions = Array.from(activeEffectsRaw.matchAll(/effect_bonus_percent(-?\d+(?:\.\d+)?).*?effect_remaining_duration(\d+).*?effect_type([a-z_]+?)(?=effect_).*?effect_until(\d+)/gi))
        .map(match => ({
            name: potionTypeNames[match[3].toLowerCase()] || match[3].toUpperCase(),
            bonusPercent: Number(match[1]),
            remainingSeconds: Number(match[2]),
            until: Number(match[4]) * 1000
        }))
        .filter(potion => potion.bonusPercent > 0);
    const mountImage = mountName ? performance.getEntriesByType('resource')
        .map(entry => entry.name)
        .find(url => url.toLowerCase().includes(mountName.toLowerCase())) || null : null;
    const player = {
        name: textValue('name'),
        pictureId: exactNumber('char_picture'),
        level: exactNumber('level'),
        strength: totalAttribute('str'),
        damageMin: exactNumber('damage_min'),
        damageMax: exactNumber('damage_max'),
        dexterity: totalAttribute('dex'),
        fightPower: exactNumber('fight_power'),
        constitution: totalAttribute('con'),
        hitpoints: exactNumber('hitpoints'),
        intelligence: totalAttribute('int'),
        magicPower: exactNumber('magic_power'),
        mount: mountName,
        mountImage,
        mountFightPower: exactNumber('mount_bonus_fightpower'),
        mountHitpoints: exactNumber('mount_bonus_hitpoints'),
        mountMagicPower: exactNumber('mount_bonus_magic_power'),
        mountStrengthPercent: exactNumber('str_mount_bonus_percent'),
        mountDexterityPercent: exactNumber('dex_mount_bonus_percent'),
        mountConstitutionPercent: exactNumber('con_mount_bonus_percent'),
        mountIntelligencePercent: exactNumber('int_mount_bonus_percent'),
        potions: activePotions,
        fame: exactNumber('fame'),
        pveRank: exactNumber('pve_rank'),
        pvpRank: exactNumber('pvp_rank'),
        experience: exactNumber('exp'),
        experienceNextLevel: exactNumber('exp_next_level'),
        guild: textValue('guildname'),
        inventorySlots: exactNumber('bag_size'),
        fightsMade: nestedNumber('heroic_fights', 'act_value')
    };
    if (Object.values(player).some(value => value !== null && value !== '')) {
        reportStatus({ player });
    }
    return player;
}

function diagnosePlayerAttributesXML(xmlString) {
    const xmlDoc = new DOMParser().parseFromString(xmlString || '', 'text/xml');
    const members = Array.from(xmlDoc.getElementsByTagName('member'));
    const names = members
        .map(member => member.getElementsByTagName('name')[0]?.textContent?.trim())
        .filter(Boolean);
    const errorMember = members.find(member => member.getElementsByTagName('name')[0]?.textContent?.trim() === 'error');
    const error = errorMember?.getElementsByTagName('value')[0]?.textContent?.trim() || null;
    const fault = names.includes('faultString')
        ? findValueByName(xmlDoc, 'faultString', 'string')
        : null;
    return {
        responseLength: String(xmlString || '').length,
        memberCount: names.length,
        fault: fault || null,
        error,
        fields: names.slice(0, 12)
    };
}

// Tanoth's XML-RPC endpoint is session based and can return empty responses
// when multiple requests for the same session overlap. Keep every request in
// one queue, including background refreshes and the main bot cycle.
let xmlRequestQueue = Promise.resolve();
const itemLanguageMapPromises = {};
function getTanothItemLanguageMap() {
    const language = String(globalThis.__TANOTH_GAME_LANGUAGE__ || 'en').toLowerCase().split(/[-_]/)[0];
    if (!itemLanguageMapPromises[language]) {
        itemLanguageMapPromises[language] = fetch(`/assets/lang/${language}.json`, { cache: 'force-cache' })
            .then(response => {
                if (!response.ok) throw new Error(`Sprachdatei HTTP ${response.status}`);
                return response.json();
            })
            .then(language => {
                const translations = {};
                for (const entry of Array.isArray(language?.keys) ? language.keys : []) {
                    const match = String(entry.key || '').match(/(UniqueName\d+|ItemNameString_(?:Amulett|Armor|Boots|Gloves|Helm|Ring|Shield|Weapon)\d+|Item_Att_String\d+|\d+_Freunde\d+)$/);
                    const value = Array.isArray(entry.content) ? entry.content[0] : entry.content;
                    if (match && typeof value === 'string' && value.trim()) translations[match[1]] = value.trim();
                }
                return translations;
            })
            .catch(error => {
                console.warn(`Itemnamen konnten nicht geladen werden: ${error.message}`);
                return {};
            });
    }
    return itemLanguageMapPromises[language];
}
function fetchXmlData(url, xmlData) {
    const request = xmlRequestQueue.then(
        () => performXmlRequest(url, xmlData),
        () => performXmlRequest(url, xmlData)
    );
    xmlRequestQueue = request.catch(() => {});
    return request;
}

async function getUserAttributesCost(){
    const xmlGetAttributes = `
    <methodCall>
        <methodName>GetUserAttributes</methodName>
        <params>
            <param>
                <value>
                    <string>${flashvars.sessionID}</string>
                </value>
            </param>
        </params>
    </methodCall>
    `;

    const xmlData = await fetchXmlData(botConfig.url, xmlGetAttributes);
    reportPlayerAttributesXML(xmlData);
    return parseAttributesXMLResponse(xmlData);

}

window.fetchTanothPlayerData = async () => {
    const xmlGetAttributes = `
    <methodCall>
        <methodName>GetUserAttributes</methodName>
        <params><param><value><string>${flashvars.sessionID}</string></value></param></params>
    </methodCall>`;
    const xmlData = await fetchXmlData(botConfig.url, xmlGetAttributes);
    const xmlGetEquipment = `<methodCall><methodName>GetEquipment</methodName><params><param><value><string>${flashvars.sessionID}</string></value></param></params></methodCall>`;
    const equipmentData = await fetchXmlData(botConfig.url, xmlGetEquipment);
    const equipmentDoc = new DOMParser().parseFromString(equipmentData || '', 'text/xml');
    const itemStructs = Array.from(equipmentDoc.querySelectorAll('array > data > value > struct'));
    const occupiedPositions = itemStructs.map(item => {
        const position = Number(findValueByName(item, 'position') ?? findValueByName(item, 'slot') ?? findValueByName(item, 'bag_position'));
        const itemId = Number(findValueByName(item, 'item_id') ?? findValueByName(item, 'id'));
        const equippedRaw = findValueByName(item, 'is_equipped');
        const isEquipped = equippedRaw === 'true' || equippedRaw === '1';
        return { position, itemId, isEquipped, hasEquipmentFlag: equippedRaw !== null };
    }).filter(item => Number.isFinite(item.itemId) && item.itemId > 0);
    const bagItems = occupiedPositions.filter(item => item.hasEquipmentFlag ? !item.isEquipped : (!Number.isFinite(item.position) || item.position >= 10));
    const equipmentFields = Array.from(equipmentDoc.getElementsByTagName('member')).map(member =>
        member.getElementsByTagName('name')[0]?.textContent?.trim()
    ).filter(Boolean);
    const player = reportPlayerAttributesXML(xmlData);
    player.inventoryOccupied = bagItems.length;
    const equipmentTypeNames = { 1: 'Amulett', 2: 'Rüstung', 3: 'Stiefel', 4: 'Handschuhe', 5: 'Helm', 6: 'Ring', 7: 'Schild', 8: 'Waffe' };
    const equipmentLanguagePrefixes = { 1: 'Amulett', 2: 'Armor', 3: 'Boots', 4: 'Gloves', 5: 'Helm', 6: 'Ring', 7: 'Shield', 8: 'Weapon' };
    const itemLanguage = await getTanothItemLanguageMap();
    const equipmentAttributeNames = { str: 'Stärke', dex: 'Geschick', con: 'Konstitution', int: 'Intelligenz' };
    const parseInventoryItem = item => {
        const type = Number(findValueByName(item, 'type'));
        const equippedRaw = findValueByName(item, 'is_equipped');
        if (!equipmentTypeNames[type]) return null;
        const isEquipped = equippedRaw === 'true' || equippedRaw === '1';
        const attributesMember = Array.from(item.getElementsByTagName('member')).find(member =>
            member.getElementsByTagName('name')[0]?.textContent?.trim() === 'attributes'
        );
        const attributes = attributesMember ? Array.from(attributesMember.getElementsByTagName('member')).map(member => {
            const key = member.getElementsByTagName('name')[0]?.textContent?.trim() || '';
            const match = key.match(/^(bonus|malus)_(str|dex|con|int)$/i);
            if (!match) return null;
            const rawValue = member.getElementsByTagName('value')[0]?.textContent?.trim();
            const value = Number(String(rawValue).match(/-?\d+(?:\.\d+)?/)?.[0]);
            if (!Number.isFinite(value)) return null;
            return {
                name: equipmentAttributeNames[match[2].toLowerCase()] || match[2].toUpperCase(),
                value: match[1].toLowerCase() === 'malus' ? -Math.abs(value) : value
            };
        }).filter(Boolean) : [];
        const itemId = Number(findValueByName(item, 'item')) || null;
        const isUnique = ['true', '1'].includes(String(findValueByName(item, 'is_unique')).toLowerCase());
        const suffixId = Number(findValueByName(item, 'suffix_id')) || null;
        const screenXRaw = findValueByName(item, 'screen_x') ?? findValueByName(item, 'position') ?? findValueByName(item, 'bag_position');
        const screenYRaw = findValueByName(item, 'screen_y');
        const screenX = screenXRaw === null ? null : Number(screenXRaw);
        const screenY = screenYRaw === null ? null : Number(screenYRaw);
        const nameKey = isUnique ? `UniqueName${itemId}` : `ItemNameString_${equipmentLanguagePrefixes[type]}${itemId}`;
        const baseName = itemLanguage[nameKey] || equipmentTypeNames[type];
        const suffixName = !isUnique && suffixId ? itemLanguage[`Item_Att_String${suffixId}`] : null;
        return {
            type,
            slot: equipmentTypeNames[type],
            name: [baseName, suffixName].filter(Boolean).join(' '),
            itemId,
            instanceId: Number(findValueByName(item, 'id')) || null,
            position: screenX,
            screenX,
            screenY,
            equipped: isEquipped,
            hasEquipmentFlag: equippedRaw !== null,
            unique: isUnique,
            suffixId,
            sellValue: Number(findValueByName(item, 'sellvalue')) || 0,
            attributes
        };
    };
    const parsedItems = itemStructs.map(parseInventoryItem).filter(Boolean);
    player.equipment = parsedItems.filter(item => item.equipped);
    player.inventoryItems = parsedItems
        .filter(item => !item.equipped)
        .sort((left, right) => (Number.isFinite(left.position) ? left.position : 999) - (Number.isFinite(right.position) ? right.position : 999))
        .slice(0, 50);
    player.companions = [];
    try {
        const partyRequest = `<methodCall><methodName>GetParty</methodName><params><param><value><string>${flashvars.sessionID}</string></value></param></params></methodCall>`;
        const companionData = await fetchXmlData(botConfig.url, partyRequest);
        const companionDoc = new DOMParser().parseFromString(companionData || '', 'text/xml');
        const directMembers = struct => Array.from(struct.children || []).filter(child => child.tagName === 'member');
        const directValue = (struct, aliases) => {
            const names = Array.isArray(aliases) ? aliases : [aliases];
            const member = directMembers(struct).find(entry => names.includes(entry.getElementsByTagName('name')[0]?.textContent?.trim()));
            if (!member) return null;
            const value = member.getElementsByTagName('value')[0];
            if (!value) return null;
            const scalar = ['string', 'i4', 'int', 'double', 'boolean'].map(tag => value.getElementsByTagName(tag)[0]).find(Boolean);
            return (scalar?.textContent || value.textContent || '').trim() || null;
        };
        const numberValue = (struct, aliases) => {
            const value = Number(directValue(struct, aliases));
            return Number.isFinite(value) ? value : null;
        };
        const companionStructs = Array.from(companionDoc.querySelectorAll('array > data > value > struct')).filter(struct => {
            const fields = directMembers(struct).map(member => member.getElementsByTagName('name')[0]?.textContent?.trim()).filter(Boolean);
            return fields.includes('id') && fields.includes('attributes') && fields.includes('fight_power');
        });
        const translations = await getTanothItemLanguageMap();
        player.companions = await Promise.all(companionStructs.map(async (struct, index) => {
            const id = numberValue(struct, 'id');
            const attributesMember = directMembers(struct).find(member => member.getElementsByTagName('name')[0]?.textContent?.trim() === 'attributes');
            const attributesStruct = attributesMember?.getElementsByTagName('struct')[0] || struct;
            const itemRequest = `<methodCall><methodName>GetPartyItems</methodName><params><param><value><string>${flashvars.sessionID}</string></value></param><param><value><int>${index + 1}</int></value></param></params></methodCall>`;
            const itemXml = await fetchXmlData(botConfig.url, itemRequest).catch(() => '');
            const itemDoc = new DOMParser().parseFromString(itemXml || '', 'text/xml');
            const companionEquipment = Array.from(itemDoc.querySelectorAll('array > data > value > struct')).map(parseInventoryItem).filter(Boolean);
            const translationKey = Object.keys(translations).find(key => key.endsWith(`_Freunde${id}`));
            return {
                id,
                name: translations[translationKey] || `Begleiter ${index + 1}`,
                level: null,
                strength: numberValue(attributesStruct, 'str_base'),
                dexterity: numberValue(attributesStruct, 'dex_base'),
                constitution: numberValue(attributesStruct, 'con_base'),
                intelligence: numberValue(attributesStruct, 'int_base'),
                image: new URL(`/main/client/assets/gfx/face/small${id}.jpg`, window.location.origin).href,
                equipment: companionEquipment
            };
        }));
    } catch (error) {
        player.companions = [];
    }
    reportStatus({ player });
    return {
        player,
        diagnostics: {
            ...diagnosePlayerAttributesXML(xmlData),
            equipmentFields: equipmentFields.slice(0, 30),
            equipmentStructCount: itemStructs.length
        }
    };
};

let autoSellInProgress = false;

function itemHasProtectedAttribute(item) {
    const protectedAttributes = Array.isArray(botConfig.autoSellKeepAttributes) ? botConfig.autoSellKeepAttributes : [];
    if (!protectedAttributes.length) return false;
    const attributeCodes = { 'Stärke': 'STR', 'Geschick': 'DEX', 'Konstitution': 'CON', 'Intelligenz': 'INT' };
    return (item.attributes || []).some(attribute =>
        Number(attribute.value) > 0 && protectedAttributes.includes(attributeCodes[attribute.name])
    );
}

function itemMatchesSellFilters(item) {
    // Only entries explicitly marked as unequipped by GetEquipment are
    // accepted. Companion items come from GetPartyItems and never enter this
    // list. screen_x is the bag item's pixel position required by SellItem.
    if (!item || !item.hasEquipmentFlag || item.equipped !== false) return false;
    if (!Number.isInteger(item.instanceId) || item.instanceId <= 0) return false;
    if (!Number.isInteger(item.screenX) || item.screenX < 0 || item.screenX > 10000) return false;
    if (!Number.isInteger(item.screenY) || item.screenY < 0 || item.screenY > 10000) return false;
    if (!Number.isFinite(item.sellValue) || item.sellValue < Number(botConfig.autoSellMinValue || 0)) return false;
    if (itemHasProtectedAttribute(item)) return false;
    if (botConfig.autoSellRarity === 'common') return !item.unique && !item.suffixId;
    if (botConfig.autoSellRarity === 'non_unique') return !item.unique;
    if (botConfig.autoSellRarity === 'all') return true;
    return false;
}

async function sellInventoryItem(item) {
    const request = `<methodCall><methodName>SellItem</methodName><params>` +
        `<param><value><string>${flashvars.sessionID}</string></value></param>` +
        `<param><value><int>${item.instanceId}</int></value></param>` +
        `<param><value><int>0</int></value></param>` +
        `<param><value><int>${item.screenX}</int></value></param>` +
        `</params></methodCall>`;
    const response = await fetchXmlData(botConfig.url, request);
    const responseDoc = new DOMParser().parseFromString(response || '', 'text/xml');
    if (responseDoc.querySelector('fault')) {
        throw new Error(responseDoc.querySelector('fault string')?.textContent?.trim() || 'SellItem wurde abgelehnt');
    }
}

async function processAutomaticSelling() {
    if (!botConfig.autoSell || autoSellInProgress || window.__TANOTH_STOP__) return;
    autoSellInProgress = true;
    try {
        const snapshot = await window.fetchTanothPlayerData();
        const inventoryItems = Array.isArray(snapshot?.player?.inventoryItems) ? snapshot.player.inventoryItems : [];
        const candidates = inventoryItems.filter(itemMatchesSellFilters);
        if (!candidates.length) return;
        console.log(`Automatic selling: ${candidates.length} inventory item(s) selected.`);
        for (const item of candidates) {
            if (window.__TANOTH_STOP__ || !botConfig.autoSell) break;
            await sellInventoryItem(item);
            console.log(`Sold inventory item: ${item.name} (${item.sellValue} gold)`);
            await sleep(0.5);
        }
        await Promise.all([window.fetchTanothPlayerData(), getCurrentResources()]);
    } catch (error) {
        console.error('Automatic selling failed:', error);
    } finally {
        autoSellInProgress = false;
    }
}

let automaticPvpInProgress = false;
let lastPvpNoMatchLogAt = 0;

function parseDirectStruct(struct) {
    const result = {};
    if (!struct) return result;
    for (const member of Array.from(struct.children || []).filter(child => child.tagName === 'member')) {
        const name = member.getElementsByTagName('name')[0]?.textContent?.trim();
        const value = member.getElementsByTagName('value')[0];
        if (!name || !value) continue;
        const scalar = ['string', 'i4', 'int', 'double', 'boolean'].map(tag => value.getElementsByTagName(tag)[0]).find(Boolean);
        result[name] = (scalar?.textContent || value.textContent || '').trim();
    }
    return result;
}

function parseXmlRpcValue(valueNode) {
    if (!valueNode) return null;
    const typed = valueNode.children?.[0];
    if (!typed) return valueNode.textContent?.trim() || null;
    if (typed.tagName === 'struct') {
        const object = {};
        for (const member of Array.from(typed.children || []).filter(child => child.tagName === 'member')) {
            const name = member.getElementsByTagName('name')[0]?.textContent?.trim();
            const value = Array.from(member.children || []).find(child => child.tagName === 'value');
            if (name) object[name] = parseXmlRpcValue(value);
        }
        return object;
    }
    if (typed.tagName === 'array') {
        const data = Array.from(typed.children || []).find(child => child.tagName === 'data');
        return Array.from(data?.children || []).filter(child => child.tagName === 'value').map(parseXmlRpcValue);
    }
    if (typed.tagName === 'boolean') return ['1', 'true'].includes(typed.textContent.trim().toLowerCase());
    if (['int', 'i4', 'double'].includes(typed.tagName)) {
        const number = Number(typed.textContent.trim());
        return Number.isFinite(number) ? number : null;
    }
    return typed.textContent?.trim() || '';
}

function finiteNumberFrom(object, aliases) {
    for (const alias of aliases) {
        if (object[alias] === undefined || object[alias] === null || object[alias] === '') continue;
        const value = Number(object[alias]);
        if (Number.isFinite(value)) return value;
    }
    return null;
}

async function getRandomPvpOpponent() {
    const request = `<methodCall><methodName>GetPvpData</methodName><params>` +
        `<param><value><string>${flashvars.sessionID}</string></value></param>` +
        `</params></methodCall>`;
    const response = await fetchXmlData(botConfig.url, request);
    const document = new DOMParser().parseFromString(response || '', 'text/xml');
    if (document.querySelector('fault')) {
        throw new Error(document.querySelector('fault string')?.textContent?.trim() || 'GetPvpData wurde abgelehnt');
    }
    const data = parseDirectStruct(document.querySelector('methodResponse struct'));
    return {
        id: finiteNumberFrom(data, ['id', 'user_id', 'player_id']),
        name: data.name || data.username || data.player_name || '',
        level: finiteNumberFrom(data, ['level', 'player_level']),
        rank: finiteNumberFrom(data, ['pvp_rank', 'rank', 'position', 'place']),
        cooldown: finiteNumberFrom(data, ['reattack_countdown', 'fight_countdown', 'countdown']) || 0,
        freeReattacks: finiteNumberFrom(data, ['free_reattacks', 'free_fights']) || 0,
        fields: Object.keys(data)
    };
}

async function resolvePvpRank(opponent) {
    const searchValue = `<string>${String(opponent.name).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</string>`;
    const request = `<methodCall><methodName>GetHighscore</methodName><params>` +
        `<param><value><string>${flashvars.sessionID}</string></value></param>` +
        `<param><value><string>USER_PVP</string></value></param>` +
        `<param><value><string>SORT_USER_FAME</string></value></param>` +
        `<param><value>${searchValue}</value></param>` +
        `</params></methodCall>`;
    const response = await fetchXmlData(botConfig.url, request);
    const document = new DOMParser().parseFromString(response || '', 'text/xml');
    if (document.querySelector('fault')) return null;
    const entries = Array.from(document.querySelectorAll('array > data > value > struct')).map(parseDirectStruct);
    const match = entries.find(entry =>
        String(entry.name || '').toLocaleLowerCase() === String(opponent.name).toLocaleLowerCase()
    );
    return match ? finiteNumberFrom(match, ['rank', 'pvp_rank', 'position', 'place']) : null;
}

function pvpOpponentMatches(opponent, player) {
    if (!opponent.name || opponent.name === player.name) return false;
    // Automatic PvP only attacks opponents below the player's own level.
    if (!Number.isFinite(opponent.level) || !Number.isFinite(player.level) || opponent.level >= player.level) return false;
    const limitType = botConfig.pvpLimitType;
    if (limitType === 'level' || limitType === 'both') {
        if (opponent.level >= Number(botConfig.pvpOpponentLevelBelow)) return false;
    }
    if (limitType === 'rank' || limitType === 'both') {
        if (!Number.isFinite(opponent.rank) || !Number.isFinite(player.pvpRank)) return false;
        if (Math.abs(opponent.rank - player.pvpRank) > Number(botConfig.pvpMaxRankDifference)) return false;
    }
    return true;
}

async function fightPvpOpponent(opponent) {
    const escapedName = String(opponent.name)
        .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;').replaceAll("'", '&apos;');
    const request = `<methodCall><methodName>Fight</methodName><params>` +
        `<param><value><string>${flashvars.sessionID}</string></value></param>` +
        `<param><value><string>${escapedName}</string></value></param>` +
        `</params></methodCall>`;
    const response = await fetchXmlData(botConfig.url, request);
    const document = new DOMParser().parseFromString(response || '', 'text/xml');
    if (document.querySelector('fault')) {
        throw new Error(document.querySelector('fault string')?.textContent?.trim() || 'Fight wurde abgelehnt');
    }
    return parseXmlRpcValue(document.querySelector('methodResponse param > value')) || {};
}

function createCombatReport(opponent, fightResponse) {
    const result = fightResponse.answer || fightResponse;
    const fameChange = finiteNumberFrom(result, ['achieved_fame', 'fame', 'fame_change']);
    const experienceChange = finiteNumberFrom(result, ['xp', 'reward_exp', 'experience']) || 0;
    const goldChange = finiteNumberFrom(result, ['robbed_gold', 'reward_gold', 'gold']) || 0;
    const explicitVictory = result.victory ?? result.won ?? result.is_winner;
    let victory;
    if (typeof explicitVictory === 'boolean') victory = explicitVictory;
    else victory = Number(fameChange) > 0 || Number(goldChange) > 0 || Number(experienceChange) > 0;
    return {
        opponentName: opponent.name,
        opponentLevel: opponent.level,
        opponentRank: opponent.rank,
        victory,
        experienceChange,
        goldChange,
        fameChange: fameChange || 0,
        timestamp: new Date().toISOString()
    };
}

async function processAutomaticPvp() {
    if (!botConfig.enablePvp || automaticPvpInProgress || window.__TANOTH_STOP__) return;
    automaticPvpInProgress = true;
    try {
        const snapshot = await window.fetchTanothPlayerData();
        const player = snapshot?.player || {};
        const seen = new Set();
        for (let attempt = 0; attempt < 8 && botConfig.enablePvp && !window.__TANOTH_STOP__; attempt++) {
            const opponent = await getRandomPvpOpponent();
            if (opponent.cooldown > 0 && opponent.freeReattacks <= 1) {
                console.log(`Automatic PvP: fight cooldown ${opponent.cooldown} seconds; no bloodstones will be used.`);
                return;
            }
            const identity = opponent.id ?? opponent.name;
            if (seen.has(identity)) break;
            seen.add(identity);
            if ((botConfig.pvpLimitType === 'rank' || botConfig.pvpLimitType === 'both') && !Number.isFinite(opponent.rank)) {
                opponent.rank = await resolvePvpRank(opponent);
            }
            if (!pvpOpponentMatches(opponent, player)) {
                continue;
            }
            if (!Number.isFinite(opponent.rank)) opponent.rank = await resolvePvpRank(opponent);
            console.log(`Automatic PvP: fighting ${opponent.name} (level ${opponent.level}, rank ${opponent.rank}).`);
            const fightResponse = await fightPvpOpponent(opponent);
            reportStatus({ reports: { combat: createCombatReport(opponent, fightResponse) } });
            console.log(`Automatic PvP fight against ${opponent.name} completed.`);
            await Promise.all([window.fetchTanothPlayerData(), getCurrentResources()]);
            return;
        }
        if (Date.now() - lastPvpNoMatchLogAt >= 10 * 60 * 1000) {
            lastPvpNoMatchLogAt = Date.now();
            console.log('Automatic PvP: no opponent matched the configured limits.');
        }
    } catch (error) {
        console.error('Automatic PvP failed:', error);
    } finally {
        automaticPvpInProgress = false;
    }
}

async function automaticPvpLoop() {
    while (!window.__TANOTH_STOP__) {
        await processAutomaticPvp();
        await sleep(30);
    }
}

let automaticDungeonInProgress = false;

async function callDungeonMethod(methodName) {
    const request = `<methodCall><methodName>${methodName}</methodName><params>` +
        `<param><value><string>${flashvars.sessionID}</string></value></param>` +
        `</params></methodCall>`;
    const response = await fetchXmlData(botConfig.url, request);
    const document = new DOMParser().parseFromString(response || '', 'text/xml');
    if (document.querySelector('fault')) {
        throw new Error(document.querySelector('fault string')?.textContent?.trim() || `${methodName} wurde abgelehnt`);
    }
    return parseXmlRpcValue(document.querySelector('methodResponse param > value')) || {};
}

async function processAutomaticDungeon() {
    if (!botConfig.enableDungeon || automaticDungeonInProgress || window.__TANOTH_STOP__) return;
    automaticDungeonInProgress = true;
    try {
        const response = await callDungeonMethod('GetDungeon');
        const dungeon = response.answer || response;
        const completed = finiteNumberFrom(dungeon, ['dungeon_made_today']) || 0;
        const freeTries = finiteNumberFrom(dungeon, ['free_tries_today']) || 0;
        const hasFreeTry = completed < freeTries;
        if (!hasFreeTry) {
            if (!botConfig.dungeonUseBloodstones) return;
            await getCurrentResources();
            if (currentResources.bloodstones - 1 < Number(botConfig.dungeonMinBloodstones || 0)) return;
        }
        const opponentId = finiteNumberFrom(dungeon, ['opp_name_id']);
        const opponentPicture = finiteNumberFrom(dungeon, ['opp_pic_id']);
        if ((!Number.isFinite(opponentId) || opponentId < 0) && (!Number.isFinite(opponentPicture) || opponentPicture < 0)) return;
        const resultResponse = await callDungeonMethod('StartDungeon');
        const result = resultResponse.answer || resultResponse;
        const report = createCombatReport({
            name: `Dungeon-Gegner ${opponentId ?? ''}`.trim(),
            level: finiteNumberFrom(dungeon, ['dungeon_level']),
            rank: null
        }, { answer: result });
        report.dungeonLevel = finiteNumberFrom(dungeon, ['dungeon_level']);
        report.freeAttempt = hasFreeTry;
        reportStatus({ reports: { dungeon: report } });
        console.log(`Automatic dungeon battle completed (level ${report.dungeonLevel ?? '?'}${hasFreeTry ? ', free attempt' : ', bloodstone attempt'}).`);
        await Promise.all([window.fetchTanothPlayerData(), getCurrentResources()]);
    } catch (error) {
        console.error('Automatic dungeon failed:', error);
    } finally {
        automaticDungeonInProgress = false;
    }
}

async function automaticDungeonLoop() {
    while (!window.__TANOTH_STOP__) {
        await processAutomaticDungeon();
        await sleep(60);
    }
}

async function refreshPlayerDataLoop() {
    while (!window.__TANOTH_STOP__) {
        await sleep(30);
        if (window.__TANOTH_STOP__) break;
        try {
            await Promise.all([window.fetchTanothPlayerData(), getCurrentResources()]);
        } catch (error) {
            // A running task can temporarily make this endpoint unavailable.
            // The next refresh retries automatically.
        }
    }
}

function getLowerCostAttribute(costValues) {
    // Find the attribute with the lowest cost value
    let minAttribute = null;
    let minValue = Infinity;

    for (const [attribute, value] of Object.entries(costValues)) {
        if (value < minValue) {
            minValue = value;
            minAttribute = attribute;
        }
    }
    return minAttribute;
}

async function upgradeUserAttribute(attributeName){
    const xmlUpgradeAttribute = `
    <methodCall>
        <methodName>RaiseAttribute</methodName>
        <params>
            <param>
                <value>
                <string>${flashvars.sessionID}</string>
                </value>
            </param>
            <param>
                <value>
                    <string>${attributeName}</string>
                </value>
            </param>
        </params>
    </methodCall>
    `;

    const xmlData = await fetchXmlData(botConfig.url, xmlUpgradeAttribute);
    return xmlData;
}


async function processAttributes() {
    let costValues = await getUserAttributesCost();
    
    while (1) {
        try {
            console.log('Cost values:', costValues);
            if (costValues.STR === null) {
                console.log('Error fetching attribute costs. Exiting attribute process.');
                break;
            }
            
            let selectedAttribute = botConfig.priorityAttribute;

            if (selectedAttribute != 'MIX' && costValues[selectedAttribute] === undefined) {
                console.log('Invalid attribute selected. Setted to MIX.');
                selectedAttribute = 'MIX';
            }

            if (selectedAttribute == 'MIX') {
                selectedAttribute = getLowerCostAttribute(costValues);
            }

            console.log('Selected attribute:', selectedAttribute);
            currentResources = await getCurrentResources();

            if (!Number.isFinite(currentResources.gold)) {
                console.log('Error fetching current resources. Exiting attribute process.');
                break;
            }

            console.log('Current Gold:', currentResources.gold, '| Bloodstones:', currentResources.bloodstones);

            if(currentResources.gold - costValues[selectedAttribute] >= botConfig.minGoldToSpend){
                costValues = parseAttributesXMLResponse(await upgradeUserAttribute(selectedAttribute));
                reportStatus({ statsEvent: { attributesBought: 1 } });

            } else {
                console.log('Not enough gold to upgrade the attribute');
                break;
            }
        } catch (error) {
            console.error('Error in attribute process:', error);
        }
        await sleep(0.5);
    }
}


async function runBot() {
    try {
        if (isBotRunning) {
            console.log('Bot is already running.');
            return;
        }
        isBotRunning = true;
        window.__TANOTH_STOP__ = false;
        console.log('Starting bot process...');
        await getUserAttributesCost().catch(error => console.warn('Could not load player attributes:', error));
        const lastCombatReport = window.__TANOTH_LAST_COMBAT_REPORT__;
        if (lastCombatReport?.opponentName && !Number.isFinite(lastCombatReport.opponentRank)) {
            const opponentRank = await resolvePvpRank({ name: lastCombatReport.opponentName, id: null }).catch(() => null);
            if (Number.isFinite(opponentRank)) {
                const enrichedReport = { ...lastCombatReport, opponentRank };
                window.__TANOTH_LAST_COMBAT_REPORT__ = enrichedReport;
                reportStatus({ reports: { combat: enrichedReport } });
            }
        }
        reportStatus({ mode: 'collecting', message: 'Bot läuft' });
        refreshPlayerDataLoop();
        automaticPvpLoop();
        automaticDungeonLoop();
        while (!window.__TANOTH_STOP__) {
            await processAutomaticSelling();
            // Handle gold spending based on configuration
            
            if (botConfig.spendGoldOn === 'circle') {
                console.log('Starting circle process...');
                await processCircle();
            } 

            if (botConfig.spendGoldOn === 'attributes') {
                console.log('Starting attributes process...');
                await processAttributes();
            } 
                 
            if (botConfig.spendGoldOn !== 'attributes' && botConfig.spendGoldOn !== 'circle') {
                console.error('Invalid value for spendGoldOn. Must be "attributes" or "circle".');
            }

            console.log('Starting new adventure cycle...');
            const adventureData = await processAdventure();
            if (adventureData.hasAnotherTaskRunning) {
                console.log(`Another task is running: ${adventureData.taskRunning.typeTask}`);
                // Check if task time have NaN value
                if (isNaN(adventureData.taskRunning.timeTask)) {
                    // MiniUpdate occasionally omits the remaining time while
                    // the task state changes. Retry shortly instead of pausing
                    // the bot for ten minutes.
                    await sleep(15);
                } else {
                    console.log(`Waiting for ${adventureData.taskRunning.timeTask} seconds before retrying...`);
                    console.log('Estimated time:', new Date(Date.now() + adventureData.taskRunning.timeTask * 1000).toLocaleTimeString());
                    await sleep(adventureData.taskRunning.timeTask + 2);

                    /* Getting the possible result of the currently running task */
                    const result = await fetchXmlData(botConfig.url, xmlGetAdventures);
                }


            }else if (!adventureData.hasRemainingAdventures && (!botConfig.useBloodstones || (currentResources.bloodstones <= botConfig.minBloodstonesToSpend))) {
                console.log('No more adventures available. Waiting 20 minutes for next cycle...');
                await sleep(20 * 60);

            }
        }
        isBotRunning = false;
        reportStatus({ mode: 'deactivated', message: 'Bot wurde angehalten' });
    } catch (error) {
        console.error('Error in bot process:', error);
        console.log('Retrying in 10 minutes...');
        await sleep(10 * 60);
        isBotRunning = false;
        if (!window.__TANOTH_STOP__) runBot(); // Restart the bot
    }
}


runBot();
