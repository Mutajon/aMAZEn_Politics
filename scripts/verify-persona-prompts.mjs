import {
    buildFreePlayIntroSystemPrompt,
    buildFreePlaySystemPrompt,
    buildFreePlayUserPrompt
} from '../server/services/freePlayPrompts.mjs';

function testPrompts() {
    console.log('--- TEST: Monarchy with The Page ---');
    const introPrompt = buildFreePlayIntroSystemPrompt(
        'King',
        'Medieval England',
        'Arthur',
        'Loyalty',
        'male',
        'serious',
        'Monarchy',
        '1215',
        'Your word is law...',
        'The Page'
    );
    console.log('INTRO SYSTEM PROMPT EXCERPT:');
    console.log(introPrompt.substring(0, 500) + '...');

    const userPromptDay1 = buildFreePlayUserPrompt(1, null, null, 0, 'Loyalty', 'serious', 'en', 'English', 'The Page');
    console.log('\nDAY 1 USER PROMPT:');
    console.log(userPromptDay1);

    const systemPrompt = buildFreePlaySystemPrompt({
        role: 'King',
        setting: 'Medieval England',
        playerName: 'Arthur',
        emphasis: 'Loyalty',
        language: 'en',
        gender: 'male',
        tone: 'serious',
        supportEntities: [],
        messenger: 'The Page'
    });
    console.log('\nSYSTEM PROMPT EXCERPT (RULES):');
    const rulesIdx = systemPrompt.indexOf('RULES:');
    console.log(systemPrompt.substring(rulesIdx, rulesIdx + 400));
}

testPrompts();
