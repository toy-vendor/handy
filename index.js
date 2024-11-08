// index.js

// Import necessary modules
import { extension_settings } from '../../../extensions.js';
import { saveSettingsDebounced } from '../../../../script.js';
import { SlashCommand } from '../../../slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument } from '../../../slash-commands/SlashCommandArgument.js';
import { SlashCommandParser } from '../../../slash-commands/SlashCommandParser.js';

const defaultSettings = {
    thehandyhandy_apikey: '',
    maxSpeed: 10,
    maxLength: 100,
};

const baseUrl = "https://www.handyfeeling.com/api/handy/v2";

function sendHandyCommand(speed, length, time) {
    // Safety checks
    if (speed < 0 || speed > extension_settings.thehandy.maxSpeed) {
        console.error('Speed out of range:', speed);
        return;
    }
    if (length < 0 || length > extension_settings.thehandy.maxLength) {
        console.error('Length out of range:', length);
        return;
    }


    const connected = await isDeviceConnected();
    if (connected) {
        console.log("Device is connected.");
        await setMode("HAMP");
        await setSpeed(speed);        // Set speed to 50%
        await startDevice();       // Start the device
		setTimeout(async () => {await stopDevice()}, time * 1000)
    } else {
        console.error("Device is not connected. Check your connection key.");
    }


    // API call to control the motor
    const handy_apikey = extension_settings.thehandy.thehandyhandy_apikey;
    if (!handy_apikey) {
        console.error('The handy API key is not set.');
        return;
    }

    const data = { speed, length };

    fetch(`${handy_apikey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
    .then(response => {
        if (response.ok) {
            console.log('Motor command sent successfully');
        } else {
            console.error('Failed to send motor command:', response.statusText);
        }
    })
    .catch(error => {
        console.error('Error sending motor command:', error);
    });
}


async function sendRequest(endpoint, method = "GET", body = null) {
    const headers = {
        "Content-Type": "application/json",
        "X-Connection-Key": handy_apikey
    };
    const response = await fetch(`${baseUrl}${endpoint}`, {
        method: method,
        headers: headers,
        body: body ? JSON.stringify(body) : null
    });
    return response.json();
}

async function isDeviceConnected() {
    const response = await sendRequest("/connected");
    return response.connected;
}

async function setMode(mode) {
    const modes = { HAMP: 0, HSSP: 1, HDSP: 2, MAINTENANCE: 3, HBSP: 4 };
    if (!(mode in modes)) {
        console.error("Invalid mode.");
        return;
    }
    const response = await sendRequest("/mode", "PUT", { mode: modes[mode] });
    console.log(`Set mode response:`, response);
}

async function setSpeed(speedPercent) {
    if (speedPercent < 0 || speedPercent > 100) {
        console.error("Speed must be between 0 and 100.");
        return;
    }
    const response = await sendRequest("/hamp/velocity", "PUT", { velocity: speedPercent });
    console.log("Set speed response:", response);
}

async function setStrokeLength(strokePercent) {
    if (strokePercent < 0 || strokePercent > 100) {
        console.error("Stroke length must be between 0 and 100.");
        return;
    }
    const response = await sendRequest("/slide", "PUT", { position: strokePercent });
    console.log("Set stroke length response:", response);
}

async function startDevice() {
    const response = await sendRequest("/hamp/start", "PUT");
    console.log("Start device response:", response);
}

async function stopDevice() {
    const response = await sendRequest("/hamp/stop", "PUT");
    console.log("Stop device response:", response);
}


function parseControlCommand(responseText) {
    const regex = /<cmd>(.*?)<\/cmd>/;
    const match = responseText.match(regex);
    if (match) {
        try {
            return JSON.parse(match[1]);
        } catch (e) {
            console.error('Failed to parse control command:', e);
        }
    }
    return null;
}

function onAIResponse(event) {
    const message = event.detail?.message;
    if (!message || !message.is_user) {
        const responseText = message?.text;
        if (!responseText) return;

        const controlCommand = parseControlCommand(responseText);
        if (controlCommand) {
            sendHandyCommand(controlCommand.speed, controlCommand.length);
        }
    }
}

jQuery(async () => {
    // Initialize extension settings
    if (extension_settings.thehandy === undefined) {
        extension_settings.thehandy = defaultSettings;
    }

    for (const key in defaultSettings) {
        if (extension_settings.thehandy[key] === undefined) {
            extension_settings.thehandy[key] = defaultSettings[key];
        }
    }

    // Create settings UI
    const html = `
    <div class="thehandy_settings">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>Motor Control</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <div>
                    <label for="handy_apikey">TheHandy API URL</label>
                    <input id="handy_apikey" class="text_pole" type="text" placeholder="http://your-motor-controller-api/command" />
                </div>
                <div>
                    <label for="handy_max_speed">Max Speed</label>
                    <input id="handy_max_speed" class="text_pole" type="number" min="0" />
                </div>
                <div>
                    <label for="handy_max_length">Max Length</label>
                    <input id="handy_max_length" class="text_pole" type="number" min="0" />
                </div>
            </div>
        </div>
    </div>`;
    $('#extensions_settings2').append(html);

    // Load settings
    $('#handy_apikey').val(extension_settings.thehandy.thehandyhandy_apikey).on('input', function () {
        extension_settings.thehandy.thehandyhandy_apikey = String($(this).val());
        saveSettingsDebounced();
    });

    $('#handy_max_speed').val(extension_settings.thehandy.maxSpeed).on('input', function () {
        extension_settings.thehandy.maxSpeed = Number($(this).val());
        saveSettingsDebounced();
    });

    $('#handy_max_length').val(extension_settings.thehandy.maxLength).on('input', function () {
        extension_settings.thehandy.maxLength = Number($(this).val());
        saveSettingsDebounced();
    });

    // Register event listener for AI responses
    addEventListener('onMessageProcessed', onAIResponse);

    // Register a slash command to manually control the motor
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'motor',
        helpString: 'Control the motor manually using /motor speed length',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Speed of the motor',
                isRequired: true,
                acceptsMultiple: false,
                typeList: ARGUMENT_TYPE.NUMBER,
            }),
            SlashCommandArgument.fromProps({
                description: 'Length to move',
                isRequired: true,
                acceptsMultiple: false,
                typeList: ARGUMENT_TYPE.NUMBER,
            }),
        ],
        callback: (args) => {
            const speed = args[0];
            const length = args[1];

            sendHandyCommand(speed, length);
            return `The Handy command sent: speed=${speed}, length=${length}`;
        },
        returns: 'Confirmation message indicating the motor command was sent.',
    }));
});
