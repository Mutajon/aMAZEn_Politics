// test-gamemode-logging.js
// Verification script for gameMode data logging

const BASE_URL = 'http://localhost:8787'; // Actual server port

async function testGameModeLogging() {
    console.log('Starting gameMode logging verification test...\n');

    const testResults = [];

    const datasets = [
        {
            name: 'Batch Logs',
            url: `${BASE_URL}/api/log/batch`,
            body: {
                sessionId: 'test-session-123',
                logs: [
                    {
                        timestamp: new Date().toISOString(),
                        userId: 'test-user-123',
                        gameVersion: '1.0.0',
                        treatment: 'control',
                        source: 'player',
                        action: 'test_click',
                        value: 'button_1',
                        gameMode: 'free play'
                    }
                ]
            }
        },
        {
            name: 'Session Start',
            url: `${BASE_URL}/api/log/session/start`,
            body: {
                userId: 'test-user-123',
                gameVersion: '1.0.0',
                treatment: 'control',
                gameMode: 'experiment'
            }
        },
        {
            name: 'Session Summary',
            url: `${BASE_URL}/api/log/summary`,
            body: {
                userId: 'test-user-123',
                sessionId: 'test-session-123',
                gameVersion: '1.0.0',
                timestamp: new Date().toISOString(),
                gameMode: 'free play',
                metrics: {},
                incomplete: false,
                aftermathGeneration: 'normal'
            }
        },
        {
            name: 'Power Questionnaire',
            url: `${BASE_URL}/api/power-questionnaire`,
            body: {
                userId: 'test-user-123',
                timestamp: Date.now(),
                type: 'initial',
                entities: [{ id: 'exec', name: 'Executive', current: 10, ideal: 10 }],
                gameMode: 'experiment'
            }
        },
        {
            name: 'Motivations Questionnaire',
            url: `${BASE_URL}/api/motivations-questionnaire`,
            body: {
                userId: 'test-user-123',
                timestamp: Date.now(),
                type: 'initial',
                motivations: [{ id: 'truth', name: 'Truth', percent: 100 }],
                gameMode: 'free play'
            }
        }
    ];

    for (const dataset of datasets) {
        try {
            const response = await fetch(dataset.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataset.body)
            });

            const data = await response.json();
            const status = response.ok ? '✅ PASS' : '❌ FAIL';
            console.log(`${status} [${dataset.name}]: ${response.status} ${response.statusText}`);
            if (!response.ok) {
                console.log('   Error:', data.error || data.errors || data.details);
            }
            testResults.push({ name: dataset.name, ok: response.ok });
        } catch (error) {
            console.log(`❌ ERROR [${dataset.name}]:`, error.message);
            testResults.push({ name: dataset.name, ok: false, error: error.message });
        }
    }

    console.log('\n--- Final Verification Results ---');
    testResults.forEach(r => {
        console.log(`${r.ok ? 'PASS' : 'FAIL'} - ${r.name}${r.error ? ` (${r.error})` : ''}`);
    });

    const allPassed = testResults.every(r => r.ok);
    if (allPassed) {
        console.log('\nAll tests passed! gameMode is correctly handled by the backend API.');
    } else {
        console.log('\nSome tests failed. Please check the logs.');
    }
}

testGameModeLogging().catch(console.error);
