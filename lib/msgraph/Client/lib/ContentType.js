/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// (C) 2024 Joost Brugman
//
// This is a very limited and crude implementation of a task that processes emails from a mailbox. This was made in a hurry as a temporary solution
// and probably has a lot o bugs and issues that were not exposed in our specific use case. Feel free to use this at your own peril. Be very, very
// prudent in your testing to ensure this works as expected in your specific use case. According to general best practices this should be rewritten
// to be more robust and reliable. On that bases you could argue this is not a production ready solution. Again, use at your own risk. 
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const Helpers = require('./Helpers.js');

function toLowerCase(value) {
    if (value === undefined) return value;
    return value.toLowerCase();
}

module.exports = class ContentType {
    constructor(header) {
        this.type = undefined;

        if (header === undefined) return;

        let disposition = Helpers.extractMultipairValues(header);
        if ('application/json' in disposition) this.type = 'application/json';

        switch (this.type) {
            case 'application/json':
                this.charset = toLowerCase(disposition['charset']);
                break;
            default:
                break;
        }
    }
}