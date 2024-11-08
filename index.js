// index.js

// Register the extension
const motorControlExtension = {
    pluginName: 'Motor Control Extension',
    init: function() {
        // Hook into the AI's response event
        addEventListener('onMessageProcessed', this.onAIResponse.bind(this));
    },

    onAIResponse: function(event) {
        const responseText = event.detail?.message?.text;
        if (!responseText) return;

        const controlCommand = this.parseControlCommand(responseText);
        if (controlCommand) {
            this.sendMotorCommand(controlCommand.speed, controlCommand.length);
        }
    },

    parseControlCommand: function(responseText) {
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
    },

    sendMotorCommand: function(speed, length) {
        // Safety constants (set according to your motor's specifications)
        const MAX_SPEED = 10;    // Replace with your motor's maximum speed
        const MAX_LENGTH = 100;  // Replace with your motor's maximum length

        // Safety checks
        if (speed < 0 || speed > MAX_SPEED) {
            console.error('Speed out of range:', speed);
            return;
        }
        if (length < 0 || length > MAX_LENGTH) {
            console.error('Length out of range:', length);
            return;
        }

        // API call to control the motor
        const apiUrl = 'http://your-motor-controller-api/command'; // Update with your API URL
        const data = { speed, length };

        fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
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
};

// Register the plugin with SillyTavern
registerPlugin(motorControlExtension);
